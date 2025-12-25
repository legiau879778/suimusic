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

// ✅ artist plan local (nếu membershipStore chưa khai báo type)
type ArtistPlan = "1m" | "3m" | "1y";

function planLabel(type: MembershipType, planCreator: CreatorPlan, planArtist: ArtistPlan) {
  if (type === "creator") return planCreator.toUpperCase();
  if (type === "artist") return planArtist === "1m" ? "1 THÁNG" : planArtist === "3m" ? "3 THÁNG" : "1 NĂM";
  return "";
}

function planSubArtist(p: ArtistPlan) {
  if (p === "1m") return "2.5 SUI · ~30 ngày";
  if (p === "3m") return "7.5 SUI · ~90 ngày";
  return "30 SUI · ~365 ngày";
}

export default function MembershipModal({ type, onClose, onSuccess }: Props) {
  const { pushToast } = useToast();
  const currentAccount = useCurrentAccount();
  const { user } = useAuth();

  const memberKey = (user?.id || user?.email || "").trim();

  const [loading, setLoading] = useState(false);

  // ✅ plan theo type
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

  // ✅ base membership cho store tính giá + thời hạn
  const base = useMemo(() => {
    if (type === "creator") return { type, plan: creatorPlan } as Pick<Membership, "type" | "plan">;

    // ✅ Artist có plan 1m/3m/1y
    if (type === "artist") return { type, plan: artistPlan as any } as Pick<Membership, "type" | "plan">;

    // business / ai (nếu ai locked thì thường không mở modal)
    return { type } as Pick<Membership, "type" | "plan">;
  }, [type, creatorPlan, artistPlan]);

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
        ...(base as any),
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

  const days = Math.max(1, Math.round(durationMs / (24 * 60 * 60 * 1000)));
  const planText = planLabel(type, creatorPlan, artistPlan);

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
              {(type === "creator" || type === "artist") && (
                <>
                  {" "}
                  · <strong>{planText}</strong>
                </>
              )}
            </div>

            <div className={styles.modalMeta}>
              <span>
                Phí dự kiến: <strong>{priceSui} SUI</strong>
              </span>
              <span>
                Thời hạn: <strong>{days} ngày</strong>
              </span>
            </div>
          </div>

          {/* ✅ CREATOR: starter/pro/studio */}
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
                      ? "5 SUI/tháng · có giới hạn"
                      : p === "pro"
                      ? "15 SUI/tháng · không giới hạn"
                      : "40 SUI/tháng · team"}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ✅ ARTIST: 1m / 3m / 1y */}
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
                  <div className={styles.pickTitle}>{p === "1m" ? "1 THÁNG" : p === "3m" ? "3 THÁNG" : "1 NĂM"}</div>
                  <div className={styles.pickSub}>{planSubArtist(p)}</div>
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
