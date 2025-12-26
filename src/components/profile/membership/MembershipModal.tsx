"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/styles/profile.module.css";
import { useToast } from "@/context/ToastContext";
import { 
  type Membership, type MembershipType, type CreatorPlan, type ArtistPlan,
  getMembershipDurationMs, getMembershipPriceSui 
} from "@/lib/membershipStore";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useAuth } from "@/context/AuthContext";
import { Transaction } from "@mysten/sui/transactions"; 
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

const PACKAGE_ID = "0xe6d99ba66e3d2b197f6cbe878d442b89c561e35ba307e8000b6e4685964c04e9";

export default function MembershipModal({ type, onClose, onSuccess }: any) {
  const { pushToast } = useToast();
  const currentAccount = useCurrentAccount();
  const { user } = useAuth();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [creatorPlan, setCreatorPlan] = useState<CreatorPlan>("starter");
  const [artistPlan, setArtistPlan] = useState<ArtistPlan>("1y");

  const base = useMemo(() => {
    if (type === "creator") return { type, plan: creatorPlan } as const;
    if (type === "artist") return { type, plan: artistPlan } as const;
    return { type } as const;
  }, [type, creatorPlan, artistPlan]);

  const priceSui = getMembershipPriceSui(base);
  const durationMs = getMembershipDurationMs(base);
  const days = Math.max(1, Math.round(durationMs / (24 * 60 * 60 * 1000)));

  async function confirm() {
    setErrorMsg(null);
    if (!currentAccount?.address) return setErrorMsg("Vui lòng kết nối ví SUI!");

    setLoading(true);
    try {
      const txb = new Transaction(); 
      const mistAmount = BigInt(Math.round(priceSui * 1_000_000_000));
      const [paymentCoin] = txb.splitCoins(txb.gas, [txb.pure.u64(mistAmount)]);
      
      txb.moveCall({
        target: `${PACKAGE_ID}::package::buy_membership`,
        arguments: [paymentCoin, txb.pure.u8(type === "artist" ? 1 : type === "creator" ? 2 : 3)],
      });

      signAndExecute({ transaction: txb }, {
        onSuccess: async (txResult) => {
          try {
            const membership: Membership = {
              type: base.type,
              plan: "plan" in base ? base.plan : undefined,
              expireAt: Date.now() + durationMs,
              txHash: txResult.digest,
              paidAmountSui: priceSui,
            };

            if (user?.id) {
              await updateDoc(doc(db, "users", user.id), {
                membership: { ...membership, active: true }
              });
            }

            pushToast("success", "Kích hoạt thành công!");
            onSuccess(membership);
            onClose();
          } catch (e: any) {
            setErrorMsg("Lỗi Firebase: " + e.message);
            setLoading(false);
          }
        },
        onError: (err) => {
          setErrorMsg(err.message);
          setLoading(false);
        },
      });
    } catch (e: any) {
      setErrorMsg("Lỗi hệ thống: " + e.message);
      setLoading(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Mua Membership</h3>
          <button className={styles.modalClose} onClick={onClose} disabled={loading} type="button">✕</button>
        </div>

        <div className={styles.modalBody}>
          {errorMsg && (
            <div style={{ background: "rgba(255, 77, 79, 0.1)", border: "1px solid #ff4d4f", color: "#ff4d4f", padding: "10px", borderRadius: "8px", marginBottom: "15px", fontSize: "14px" }}>
              <strong>Thông báo:</strong> {errorMsg}
            </div>
          )}

          <div className={styles.modalSummary}>
            <div className={styles.modalLine}>
              Bạn đang mua gói <strong>{type.toUpperCase()} - {
                type === "creator" ? creatorPlan.toUpperCase() : 
                type === "artist" ? (artistPlan === "1y" ? "1 NĂM" : artistPlan === "3m" ? "3 THÁNG" : "1 THÁNG") : ""
              }</strong>
            </div>
            <div className={styles.modalMeta}>
              <span className={styles.metaPill}>Phí: <strong>{priceSui} SUI</strong></span>
              <span className={styles.metaPill}>Thời hạn: <strong>{days} ngày</strong></span>
            </div>
          </div>
          {type === "creator" && (
            <div className={styles.planGrid}>
              {(["starter", "pro", "studio"] as CreatorPlan[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.pickBtn} ${creatorPlan === p ? styles.pickActive : ""}`}
                  onClick={() => { setCreatorPlan(p); setErrorMsg(null); }}
                  disabled={loading}
                >
                  <div className={styles.pickTitle}>{p.toUpperCase()}</div>
                  <div className={styles.pickSub}>{p === "starter" ? "0.01 SUI" : p === "pro" ? "0.02 SUI" : "0.05 SUI"}/tháng</div>
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
                  onClick={() => { setArtistPlan(p); setErrorMsg(null); }}
                  disabled={loading}
                >
                  <div className={styles.pickTitle}>{p === "1m" ? "1 THÁNG" : p === "3m" ? "3 THÁNG" : "1 NĂM"}</div>
                  <div className={styles.pickSub}>{p === "1m" ? "0.01 SUI" : p === "3m" ? "0.02 SUI" : "0.03 SUI"}</div>
                </button>
              ))}
            </div>
          )}

          <div className={styles.modalHint}>
            * Vui lòng đảm bảo số dư SUI đủ để thanh toán phí gói và phí gas mạng lưới.
          </div>
        </div>

        <div className={styles.modalActions}>
          <button className={styles.secondaryBtn} onClick={onClose} disabled={loading} type="button">Huỷ</button>
          <button className={styles.primaryBtn} onClick={confirm} disabled={loading} type="button">
            {loading ? "Đang xử lý..." : "Xác nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}