"use client";

import { useEffect, useState } from "react";
import styles from "@/styles/profile.module.css";
import { useAuth } from "@/context/AuthContext";
import {
  connectSuiWallet,
  signSuiMessage,
  getSuiBalance,
} from "@/lib/suiWallet";

export default function WalletPanel() {
  const { user, setUser } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  /* =========================
     AUTO LOAD BALANCE
  ========================= */

  useEffect(() => {
    if (!user?.wallet?.address) return;

    let alive = true;

    async function loadBalance() {
      const b = await getSuiBalance(user.wallet!.address);
      if (alive) setBalance(b);
    }

    loadBalance();

    // 🔁 auto refresh mỗi 15s
    const interval = setInterval(loadBalance, 15000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [user?.wallet?.address]);

  /* =========================
     CONNECT WALLET
  ========================= */

  async function connect() {
    try {
      setLoading(true);

      const address = await connectSuiWallet();

      const message = `Chainstorm verify wallet\n${user?.email}`;
      const signature = await signSuiMessage(message);

      const updated = {
        ...user!,
        wallet: {
          address,
          verified: true,
          signature,
        },
        role: user!.role === "admin" ? "admin" : "author",
      };

      setUser(updated);
      localStorage.setItem("auth_user", JSON.stringify(updated));
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     REVOKE WALLET
  ========================= */

  function revoke() {
    const updated = { ...user! };
    delete updated.wallet;

    setUser(updated);
    localStorage.setItem("auth_user", JSON.stringify(updated));
  }

  /* =========================
     UI
  ========================= */

  return (
    <div className={styles.walletCard}>
      <h2>Ví SUI</h2>

      {!user?.wallet ? (
        <button
          className={styles.connectBtn}
          onClick={connect}
          disabled={loading}
        >
          {loading ? "Đang kết nối..." : "Kết nối ví SUI"}
        </button>
      ) : (
        <>
          <div className={styles.walletField}>
            <label>Địa chỉ ví</label>
            <input
              value={user.wallet.address}
              disabled
            />
          </div>

          <div className={styles.balanceBox}>
            <span>Số dư</span>
            <strong>{balance.toFixed(4)} SUI</strong>
          </div>

          <button
            className={styles.revokeBtn}
            onClick={revoke}
          >
            Gỡ ví
          </button>
        </>
      )}
    </div>
  );
}
