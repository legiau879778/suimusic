"use client";

import { useEffect, useState } from "react";
import styles from "@/styles/profile.module.css";
import { useAuth } from "@/context/AuthContext";
import { getSuiBalance } from "@/lib/suiWallet";

export default function WalletPanel() {
  const { user, connectWallet, revokeWallet } = useAuth();
  const [balance, setBalance] = useState<number>(0);

  /* =========================
     AUTO LOAD BALANCE
  ========================= */

  useEffect(() => {
    if (!user?.wallet?.address) return;

    let alive = true;
    const address = user.wallet.address; // ✅ capture chắc chắn

    async function loadBalance() {
      const b = await getSuiBalance(address);
      if (alive) setBalance(b);
    }

    loadBalance();
    const interval = setInterval(loadBalance, 15000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [user?.wallet?.address]);

  if (!user) return null;

  /* =========================
     UI
  ========================= */

  return (
    <div className={styles.walletCard}>
      <h2>Ví SUI</h2>

      {!user.wallet ? (
        <button
          className={styles.connectBtn}
          onClick={connectWallet}   // ✅ GỌI CONTEXT
        >
          Kết nối ví SUI
        </button>
      ) : (
        <>
          <div className={styles.walletField}>
            <label>Địa chỉ ví</label>
            <input value={user.wallet.address} disabled />
          </div>

          <div className={styles.balanceBox}>
            <span>Số dư</span>
            <strong>{balance.toFixed(4)} SUI</strong>
          </div>

          <button
            className={styles.revokeBtn}
            onClick={revokeWallet}  // ✅ GỌI CONTEXT
          >
            Gỡ ví
          </button>
        </>
      )}
    </div>
  );
}
