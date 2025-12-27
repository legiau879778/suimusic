"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import styles from "@/styles/admin/adminReview.module.css";

import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  getPendingWorks,
  approveWork,
  rejectWork,
  setWorkQuorumWeight,
  getWorkByProofId,
  type Work,
} from "@/lib/workStore";
import type { ProofRecord } from "@/lib/proofTypes";
import { signApproveMessage } from "@/lib/signApproveMessage";

export default function AdminReviewPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [works, setWorks] = useState<Work[]>([]);
  const [proofs, setProofs] = useState<ProofRecord[]>([]);
  const [qMap, setQMap] = useState<Record<string, string>>({}); // workId -> input quorum string
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    const list = getPendingWorks();
    setWorks(list);

    // init quorum input map (do not overwrite while user is typing)
    setQMap((prev) => {
      const next = { ...prev };
      for (const w of list) {
        if (next[w.id] == null) next[w.id] = String(w.quorumWeight ?? 1);
      }
      return next;
    });
  };

  async function loadProofs() {
    try {
      const res = await fetch("/api/proof", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok && Array.isArray(data.proofs)) {
        const list = (data.proofs as ProofRecord[])
          .filter((p) => {
            const s = String(p?.status || "").trim().toLowerCase();
            return s === "submitted" || s === "tsa_attested";
          })
          .sort(
            (a, b) => Date.parse(String(b.createdAt || "")) - Date.parse(String(a.createdAt || ""))
          );
        setProofs(list);
      }
    } catch {}
  }

  useEffect(() => {
    load();
    void loadProofs();

    const onUpdate = () => load();
    window.addEventListener("works_updated", onUpdate);
    return () => window.removeEventListener("works_updated", onUpdate);
  }, []);

  const reviewerId = user?.email || user?.id || "admin";
  const reviewerRole = user?.role || "admin";

  const totalPending = works.length + proofs.length;

  const weightHint = useMemo(() => {
    // must match getReviewerWeightByRole() in the store
    return reviewerRole === "admin" ? 2 : 1;
  }, [reviewerRole]);

  const calcTotalWeight = (w: Work) =>
    Object.values(w.approvalMap || {}).reduce((s, v) => s + (Number(v) || 0), 0);

  const onApprove = async (w: Work) => {
    if (!reviewerId) return;
    setBusyId(w.id);
    try {
      if (!w.proofId) {
        throw new Error("This work does not have a proofId for TSA approval.");
      }

      const signed = await signApproveMessage(w.id, w.proofId);

      const res = await fetch("/api/proof/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proofId: w.proofId,
          adminWallet: signed.adminWallet,
          signature: signed.signature,
          message: signed.message,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "TSA approval failed");
      }

      approveWork({
        workId: w.id,
        reviewerId,
        reviewerRole,
        // no weight passed => store infers from role
      });
      if (w.proofId) {
        setProofs((prev) => prev.filter((x) => x.id !== w.proofId));
      }
      // load() will be triggered via works_updated (save() dispatches event), but call now for smoother UI
      load();
      const notify = data?.notify;
      if (notify?.email || notify?.webhook) {
        showToast("Approved and notification sent", "success");
      } else {
        showToast("Approved TSA and updated status", "success");
      }
    } catch (e: any) {
      showToast(e?.message || "Unable to approve TSA", "error");
    } finally {
      setBusyId(null);
    }
  };

  const onApproveProof = async (p: ProofRecord) => {
    const reviewerIdLocal = reviewerId;
    if (!reviewerIdLocal) return;
    setBusyId(p.id);
    try {
      const signed = await signApproveMessage(p.metaHash, p.id);

      const res = await fetch("/api/proof/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proofId: p.id,
          adminWallet: signed.adminWallet,
          signature: signed.signature,
          message: signed.message,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "TSA approval failed");
      }

      const maybeWork = getWorkByProofId(p.id);
      if (maybeWork) {
        approveWork({
          workId: maybeWork.id,
          reviewerId: reviewerIdLocal,
          reviewerRole,
        });
      }

      setProofs((prev) => prev.filter((x) => x.id !== p.id));
      const notify = data?.notify;
      if (notify?.email || notify?.webhook) {
        showToast("Approved and notification sent", "success");
      } else {
        showToast("Approved TSA for profile", "success");
      }
    } catch (e: any) {
      showToast(e?.message || "Unable to approve TSA", "error");
    } finally {
      setBusyId(null);
    }
  };

  const onRejectProof = async (p: ProofRecord) => {
    const reviewerIdLocal = reviewerId;
    if (!reviewerIdLocal) return;
    const reason = prompt("Reject reason (optional):") ?? "";
    setBusyId(p.id);
    try {
      const signed = await signApproveMessage(p.metaHash, p.id);

      const res = await fetch("/api/proof/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proofId: p.id,
          adminWallet: signed.adminWallet,
          signature: signed.signature,
          message: signed.message,
          reject: true,
          reason,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Reject failed");
      }
      const maybeWork = getWorkByProofId(p.id);
      if (maybeWork) {
        rejectWork({
          workId: maybeWork.id,
          reviewerId: reviewerIdLocal,
          reason,
        });
      }
      setProofs((prev) => prev.filter((x) => x.id !== p.id));
      const notify = data?.notify;
      if (notify?.email || notify?.webhook) {
        showToast("Rejected and notification sent", "warning");
      } else {
        showToast("Profile rejected", "warning");
      }
    } catch (e: any) {
      showToast(e?.message || "Unable to reject", "error");
    } finally {
      setBusyId(null);
    }
  };

  const pendingProofs = useMemo(() => proofs, [proofs]);

  const onReject = async (w: Work) => {
    if (!reviewerId) return;
    const reason = prompt("Reject reason (optional):") ?? "";
    setBusyId(w.id);
    try {
      if (w.proofId) {
        const signed = await signApproveMessage(w.id, w.proofId);
        const res = await fetch("/api/proof/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proofId: w.proofId,
            adminWallet: signed.adminWallet,
            signature: signed.signature,
            message: signed.message,
            reject: true,
            reason,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Reject failed");
        }
        if (data?.notify?.email || data?.notify?.webhook) {
          showToast("Rejected and notification sent", "warning");
        }
      }
      rejectWork({
        workId: w.id,
        reviewerId,
        reason,
      });
      if (w.proofId) {
        setProofs((prev) => prev.filter((x) => x.id !== w.proofId));
      }
      load();
    } finally {
      setBusyId(null);
    }
  };

  const onSaveQuorum = async (w: Work) => {
    const raw = qMap[w.id] ?? "";
    const q = Math.max(1, Math.floor(Number(raw || 1)));
    setBusyId(w.id);
    try {
      setWorkQuorumWeight({ workId: w.id, quorumWeight: q });
      load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminGuard>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Work review</h1>
            <p className={styles.sub}>
              Pending: <b>{totalPending}</b> • Your weight: <b>{weightHint}</b>
            </p>
          </div>
        </div>

        {works.length === 0 && pendingProofs.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>✓</div>
            <div className={styles.emptyTitle}>No works pending review</div>
            <div className={styles.emptySub}>All pending works have been handled.</div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Work</th>
                  <th>Sell</th>
                  <th>Quorum</th>
                  <th>Approvals</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {pendingProofs.map((p) => {
                  const title =
                    String(p.metadata?.name || p.metadata?.title || "Untitled");
                  const authorEmail =
                    String(
                      p.metadata?.properties?.author?.email ||
                        p.metadata?.author?.email ||
                        p.metadata?.email ||
                        ""
                    ).trim();
                  const metaLink = p.walrusMetaId
                    ? `/api/walrus/blob/${p.walrusMetaId}`
                    : "";
                  const sellType = String(
                    p.metadata?.attributes?.find?.((a: any) => a?.trait_type === "sellType")
                      ?.value || "-"
                  );
                  const isBusy = busyId === p.id;
                  return (
                    <tr key={`proof-${p.id}`}>
                      <td className={styles.workCell}>
                        <div className={styles.workTitle}>{title}</div>
                        <div className={styles.workMeta}>
                          <span className={styles.mono}>Proof: {p.id.slice(0, 8)}…</span>
                          {p.wallet && (
                            <span className={styles.mono}>Owner: {p.wallet.slice(0, 8)}…</span>
                          )}
                          {authorEmail ? (
                            <span className={styles.mono}>Email: {authorEmail}</span>
                          ) : null}
                          {metaLink ? (
                            <a className={styles.link} href={metaLink} target="_blank" rel="noreferrer">
                              Metadata
                            </a>
                          ) : null}
                        </div>
                      </td>

                      <td>
                        <span className={`${styles.badge} ${styles.license}`}>
                          {sellType ? String(sellType).toUpperCase() : "—"}
                        </span>
                      </td>

                      <td className={styles.quorumCell}>
                        <div className={styles.quorumHint}>Quorum not synced yet</div>
                      </td>

                      <td>
                        <div className={styles.approvalBox}>
                          <div className={styles.approvalTop}>
                            <span className={styles.approvalNum}>0/1</span>
                            <span className={`${styles.dot} ${styles.dotPending}`} />
                          </div>
                          <div className={styles.approvalList}>
                            <span className={styles.muted}>None yet</span>
                          </div>
                        </div>
                      </td>

                      <td className={styles.actionsCell}>
                        <button
                          className={styles.approveBtn}
                          onClick={() => onApproveProof(p)}
                          disabled={isBusy}
                        >
                          Approve (+{weightHint})
                        </button>
                        <button
                          className={styles.rejectBtn}
                          onClick={() => onRejectProof(p)}
                          disabled={isBusy}
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {works.map((w) => {
                  const totalWeight = calcTotalWeight(w);
                  const quorum = w.quorumWeight ?? 1;
                  const isBusy = busyId === w.id;

                  return (
                    <tr key={w.id}>
                      <td className={styles.workCell}>
                        <div className={styles.workTitle}>{w.title}</div>
                        <div className={styles.workMeta}>
                          <span className={styles.mono}>ID: {w.id.slice(0, 8)}…</span>
                          {w.authorWallet && (
                            <span className={styles.mono}>Owner: {w.authorWallet.slice(0, 8)}…</span>
                          )}
                        </div>
                      </td>

                      <td>
                        <span className={`${styles.badge} ${w.sellType === "exclusive" ? styles.exclusive : styles.license}`}>
                          {w.sellType.toUpperCase()}
                        </span>
                      </td>

                      <td className={styles.quorumCell}>
                        <div className={styles.quorumRow}>
                          <input
                            className={styles.quorumInput}
                            value={qMap[w.id] ?? String(quorum)}
                            onChange={(e) =>
                              setQMap((prev) => ({ ...prev, [w.id]: e.target.value }))
                            }
                            inputMode="numeric"
                          />
                          <button
                            className={styles.smallBtn}
                            onClick={() => onSaveQuorum(w)}
                            disabled={isBusy}
                            title="Save quorumWeight"
                          >
                            Save
                          </button>
                        </div>
                        <div className={styles.quorumHint}>
                          Verified when <b>total weight</b> &gt;= <b>{quorum}</b>
                        </div>
                      </td>

                      <td>
                        <div className={styles.approvalBox}>
                          <div className={styles.approvalTop}>
                            <span className={styles.approvalNum}>
                              {totalWeight}/{quorum}
                            </span>
                            <span
                              className={`${styles.dot} ${
                                totalWeight >= quorum ? styles.dotOk : styles.dotPending
                              }`}
                            />
                          </div>

                          <div className={styles.approvalList}>
                            {Object.keys(w.approvalMap || {}).length === 0 ? (
                              <span className={styles.muted}>None yet</span>
                            ) : (
                              Object.entries(w.approvalMap).map(([k, v]) => (
                                <span key={k} className={styles.approvalPill} title={k}>
                                  {k.split("@")[0]}: {v}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </td>

                      <td className={styles.actionsCell}>
                        <button
                          className={styles.approveBtn}
                          onClick={() => onApprove(w)}
                          disabled={isBusy}
                        >
                          Approve (+{weightHint})
                        </button>
                        <button
                          className={styles.rejectBtn}
                          onClick={() => onReject(w)}
                          disabled={isBusy}
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
