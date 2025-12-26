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
  type Work,
} from "@/lib/workStore";
import { signApproveMessage } from "@/lib/signApproveMessage";

export default function AdminReviewPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [works, setWorks] = useState<Work[]>([]);
  const [qMap, setQMap] = useState<Record<string, string>>({}); // workId -> input quorum string
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    const list = getPendingWorks();
    setWorks(list);

    // init quorum input map (không overwrite nếu user đang gõ)
    setQMap((prev) => {
      const next = { ...prev };
      for (const w of list) {
        if (next[w.id] == null) next[w.id] = String(w.quorumWeight ?? 1);
      }
      return next;
    });
  };

  useEffect(() => {
    load();

    const onUpdate = () => load();
    window.addEventListener("works_updated", onUpdate);
    return () => window.removeEventListener("works_updated", onUpdate);
  }, []);

  const reviewerId = user?.email || user?.id || "admin";
  const reviewerRole = user?.role || "admin";

  const totalPending = works.length;

  const weightHint = useMemo(() => {
    // phải khớp getReviewerWeightByRole() trong store
    return reviewerRole === "admin" ? 2 : 1;
  }, [reviewerRole]);

  const calcTotalWeight = (w: Work) =>
    Object.values(w.approvalMap || {}).reduce((s, v) => s + (Number(v) || 0), 0);

  const onApprove = async (w: Work) => {
    if (!reviewerId) return;
    setBusyId(w.id);
    try {
      if (!w.proofId) {
        throw new Error("Tác phẩm chưa có proofId để duyệt TSA");
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
        throw new Error(data?.error || "Approve TSA thất bại");
      }

      approveWork({
        workId: w.id,
        reviewerId,
        reviewerRole,
        // không truyền weight => store tự suy ra theo role
      });
      // load() sẽ tự gọi qua works_updated (save() dispatch event), nhưng gọi luôn để UI mượt
      load();
      showToast("Đã duyệt TSA + cập nhật trạng thái", "success");
    } catch (e: any) {
      showToast(e?.message || "Không thể duyệt TSA", "error");
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async (w: Work) => {
    if (!reviewerId) return;
    const reason = prompt("Lý do từ chối (tuỳ chọn):") ?? "";
    setBusyId(w.id);
    try {
      rejectWork({
        workId: w.id,
        reviewerId,
        reason,
      });
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
            <h1 className={styles.title}>Duyệt tác phẩm</h1>
            <p className={styles.sub}>
              Pending: <b>{totalPending}</b> • Weight của bạn: <b>{weightHint}</b>
            </p>
          </div>
        </div>

        {works.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>✓</div>
            <div className={styles.emptyTitle}>Không có tác phẩm chờ duyệt</div>
            <div className={styles.emptySub}>Mọi tác phẩm pending đã được xử lý.</div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tác phẩm</th>
                  <th>Sell</th>
                  <th>Quorum</th>
                  <th>Approvals</th>
                  <th>Hành động</th>
                </tr>
              </thead>

              <tbody>
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
                            title="Lưu quorumWeight"
                          >
                            Lưu
                          </button>
                        </div>
                        <div className={styles.quorumHint}>
                          Verified khi <b>tổng weight</b> ≥ <b>{quorum}</b>
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
                              <span className={styles.muted}>Chưa có</span>
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
                          Duyệt (+{weightHint})
                        </button>
                        <button
                          className={styles.rejectBtn}
                          onClick={() => onReject(w)}
                          disabled={isBusy}
                        >
                          Từ chối
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
