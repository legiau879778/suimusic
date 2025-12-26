"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/styles/profile.module.css";
import { useToast } from "@/context/ToastContext";
import {
  saveMembership,
  type Membership,
  type MembershipType,
  type CreatorPlan,
  type ArtistPlan,
  getMembershipDurationMs,
  getMembershipPriceSui,
} from "@/lib/membershipStore";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useAuth } from "@/context/AuthContext";

type Props = {
  type: MembershipType;
  onClose: () => void;
  onSuccess: (m: Membership) => void;
};

export default function MembershipModal({ type, onClose, onSuccess }: Props) {
  const { pushToast } = useToast();
  const currentAccount = useCurrentAccount();
  const { user } = useAuth();

  const memberKey = (user?.id || user?.email || "").trim();

  const [loading, setLoading] = useState(false);

  const [creatorPlan, setCreatorPlan] = useState<CreatorPlan>("starter");
  const [artistPlan, setArtistPlan] = useState<ArtistPlan>("1y");

  useEffect(() => {
    if (type === "creator") setCreatorPlan("starter");
    if (type === "artist") setArtistPlan("1y");
  }, [type]);

  // ✅ lock scroll when modal open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const base = useMemo(() => {
    if (type === "creator") return { type, plan: creatorPlan } as const;
    if (type === "artist") return { type, plan: artistPlan } as const;
    return { type } as const;
  }, [type, creatorPlan, artistPlan]);

  const priceSui = useMemo(() => getMembershipPriceSui(base), [base]);
  const durationMs = useMemo(() => getMembershipDurationMs(base), [base]);

  const days = Math.max(1, Math.round(durationMs / (24 * 60 * 60 * 1000)));

  async function confirm() {
    if (!currentAccount?.address) {
      pushToast("error", "Please connect a SUI wallet");
      return;
    }
    if (!memberKey) {
      pushToast("error", "User not identified");
      return;
    }

    setLoading(true);
    try {
      const txHash = "demo_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
      const expireAt = Date.now() + durationMs;

      const membership: Membership = {
        type: base.type,
        plan: "plan" in base ? base.plan : undefined,
        expireAt,
        txHash,
        paidAmountSui: priceSui,
      };

      saveMembership(memberKey, membership);

      pushToast("success", "Membership activated successfully");
      onSuccess(membership);
      onClose();
    } catch (e: any) {
      pushToast("error", e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Purchase Membership</h3>
          <button className={styles.modalClose} onClick={onClose} disabled={loading} type="button">
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.modalSummary}>
            <div className={styles.modalLine}>
              You are purchasing <strong>{type.toUpperCase()}</strong>
              {type === "creator" ? (
                <>
                  {" "}
                  · <strong>{creatorPlan.toUpperCase()}</strong>
                </>
              ) : type === "artist" ? (
                <>
                  {" "}
                  ·{" "}
                  <strong>
                    {artistPlan === "1m" ? "1 MONTH" : artistPlan === "3m" ? "3 MONTHS" : "1 YEAR"}
                  </strong>
                </>
              ) : null}
            </div>

            <div className={styles.modalMeta}>
              <span>
                Estimated fee: <strong>{priceSui} SUI</strong>
              </span>
              <span>
                Duration: <strong>{days} days</strong>
              </span>
            </div>
          </div>

          {type === "creator" && (
            <div className={styles.planGrid}>
              {(["starter", "pro", "studio"] as CreatorPlan[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.pickBtn} ${creatorPlan === p ? styles.pickActive : ""}`}
                  onClick={() => setCreatorPlan(p)}
                  disabled={loading}
                >
                  <div className={styles.pickTitle}>{p.toUpperCase()}</div>
                  <div className={styles.pickSub}>
                    {p === "starter"
                      ? "5 SUI/month · limited"
                      : p === "pro"
                      ? "15 SUI/month · unlimited"
                      : "40 SUI/month · team"}
                  </div>
                </button>
              ))}
            </div>
          )}

          {type === "artist" && (
            <div className={styles.planGrid}>
              {(["1m", "3m", "1y"] as ArtistPlan[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.pickBtn} ${artistPlan === p ? styles.pickActive : ""}`}
                  onClick={() => setArtistPlan(p)}
                  disabled={loading}
                >
                  <div className={styles.pickTitle}>{p === "1m" ? "1 MONTH" : p === "3m" ? "3 MONTHS" : "1 YEAR"}</div>
                  <div className={styles.pickSub}>
                    {p === "1m" ? "2.5 SUI · ~30 days" : p === "3m" ? "7.5 SUI · ~90 days" : "30 SUI · ~365 days"}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className={styles.modalHint}>
            * SUI wallet required to confirm. (Note: extension wallet is shared, but membership is saved to your Gmail account.)
          </div>
        </div>

        <div className={styles.modalActions}>
          <button className={styles.secondaryBtn} onClick={onClose} disabled={loading} type="button">
            Cancel
          </button>
          <button className={styles.primaryBtn} onClick={confirm} disabled={loading} type="button">
            {loading ? "Processing..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
