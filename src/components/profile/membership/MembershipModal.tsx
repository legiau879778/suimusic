"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/styles/profile.module.css";
import { useToast } from "@/context/ToastContext";
import {
  saveMembership,
  type Membership,
  type MembershipType,
  type CreatorPlan,
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
  const [plan, setPlan] = useState<CreatorPlan>("starter");

  useEffect(() => {
    if (type === "creator") setPlan("starter");
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
    const b: Pick<Membership, "type" | "plan"> = type === "creator" ? { type, plan } : { type };
    return b;
  }, [type, plan]);

  const priceSui = useMemo(() => getMembershipPriceSui(base), [base]);
  const durationMs = useMemo(() => getMembershipDurationMs(base), [base]);

  async function confirm() {
    if (!currentAccount?.address) {
      pushToast("error", "Vui lòng kết nối ví SUI");
      return;
    }
    if (!memberKey) {
      pushToast("error", "Chưa xác định người dùng");
      return;
    }

    setLoading(true);
    try {
      const txHash = "0x" + Math.random().toString(16).slice(2) + Date.now().toString(16);
      const expireAt = Date.now() + durationMs;

      const membership: Membership = {
        ...base,
        expireAt,
        txHash,
        paidAmountSui: priceSui,
      };

      // ✅ SAVE THEO memberKey chuẩn
      saveMembership(memberKey, membership);

      pushToast("success", "🎉 Kích hoạt Membership thành công");
      onSuccess(membership);
      onClose();
    } catch (e: any) {
      pushToast("error", e?.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Mua Membership</h3>
          <button className={styles.modalClose} onClick={onClose} disabled={loading} type="button">
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.modalSummary}>
            <div className={styles.modalLine}>
              Bạn đang mua gói <strong>{type.toUpperCase()}</strong>
              {type === "creator" ? (
                <>
                  {" "}
                  · <strong>{plan.toUpperCase()}</strong>
                </>
              ) : null}
            </div>

            <div className={styles.modalMeta}>
              <span>
                Phí dự kiến: <strong>{priceSui} SUI</strong>
              </span>
              <span>
                Thời hạn: <strong>{Math.round(durationMs / (24 * 60 * 60 * 1000))} ngày</strong>
              </span>
            </div>
          </div>

          {type === "creator" && (
            <div className={styles.planGrid}>
              {(["starter", "pro", "studio"] as CreatorPlan[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.pickBtn} ${plan === p ? styles.pickActive : ""}`}
                  onClick={() => setPlan(p)}
                  disabled={loading}
                >
                  <div className={styles.pickTitle}>{p.toUpperCase()}</div>
                  <div className={styles.pickSub}>
                    {p === "starter"
                      ? "5 SUI/tháng · có giới hạn"
                      : p === "pro"
                      ? "15 SUI/tháng · không giới hạn"
                      : "40 SUI/tháng · team"}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className={styles.modalHint}>
            * Cần ví SUI để xác nhận. (Lưu ý: ví extension là dùng chung, nhưng membership sẽ lưu theo tài khoản Gmail của
            bạn.)
          </div>
        </div>

        <div className={styles.modalActions}>
          <button className={styles.secondaryBtn} onClick={onClose} disabled={loading} type="button">
            Huỷ
          </button>
          <button className={styles.primaryBtn} onClick={confirm} disabled={loading} type="button">
            {loading ? "Đang xử lý..." : "Xác nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}
