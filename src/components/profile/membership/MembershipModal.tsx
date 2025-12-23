"use client";

import styles from "@/styles/profile.module.css";
import { payMembership } from "@/lib/suiPayment";
import { useCurrentWallet } from "@mysten/dapp-kit";

export default function MembershipModal({
  type,
  onClose,
  onConfirm,
}: {
  type: "artist" | "creator" | "business";
  onClose: () => void;
  onConfirm: (tx: { txHash: string; block: number }, plan?: any) => void;
}) {
  const wallet = useCurrentWallet();

  const pay = async (price: number, plan?: any) => {
    if (!wallet || !wallet.signAndExecuteTransactionBlock) return;

    const tx = await payMembership({
      wallet,
      amountSui: price,
    });

    onConfirm(tx, plan);
  };

  return (
    <div className={styles.lockOverlay}>
      <div className={styles.lockCard}>
        <h3>{type.toUpperCase()} Membership</h3>

        {type === "creator" ? (
          <div className={styles.planGrid}>
            <div onClick={() => pay(5, "starter")} className={styles.planCard}>
              STARTER – 5 SUI
            </div>
            <div onClick={() => pay(15, "pro")} className={styles.planCard}>
              PRO – 15 SUI
            </div>
            <div onClick={() => pay(40, "studio")} className={styles.planCard}>
              STUDIO – 40 SUI
            </div>
          </div>
        ) : (
          <>
            <div className={styles.priceBox}>
              {type === "artist" ? "30" : "50"} SUI / năm
            </div>
            <button
              className={styles.confirmBtnWhite}
              onClick={() => pay(type === "artist" ? 30 : 50)}
            >
              Thanh toán
            </button>
          </>
        )}

        <button onClick={onClose}>Đóng</button>
      </div>
    </div>
  );
}
