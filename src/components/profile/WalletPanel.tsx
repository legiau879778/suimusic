"use client";

import { useEffect, useState } from "react";
import styles from "@/styles/profile.module.css";
import { useAuth } from "@/context/AuthContext";
import {
  detectSuietStatus,
  getSuiBalance,
} from "@/lib/suiWallet";

/* =========================
   TYPES
========================= */
type SuietStatus = "not-installed" | "locked" | "ready";

export default function WalletPanel() {
  const { user, connectWallet, revokeWallet } = useAuth();

  const [status, setStatus] =
    useState<SuietStatus>("not-installed");
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  /* =========================
     DETECT SUIET STATUS
  ========================= */
  useEffect(() => {
    detectSuietStatus().then(setStatus);
  }, []);

  /* =========================
     LOAD BALANCE
  ========================= */
  useEffect(() => {
    if (!user?.wallet?.address) return;

    let alive = true;
    const address = user.wallet.address;

    async function loadBalance() {
      try {
        const b = await getSuiBalance(address);
        if (alive) setBalance(b);
      } catch (e) {
        console.error("Load balance failed", e);
      }
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
     HANDLERS
  ========================= */
  async function handleConnect() {
    setLoading(true);
    try {
      await connectWallet();
      // Sau khi user click connect, re-check status
      const s = await detectSuietStatus();
      setStatus(s);
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     UI
  ========================= */
  return (
    <div className={styles.walletCard}>
      <h2>Ví SUI</h2>

      {/* =====================
          CHƯA CONNECT
      ===================== */}
      {!user.wallet && (
        <>
          <button
            className={styles.connectBtn}
            onClick={handleConnect}
            disabled={loading}
          >
            {loading ? "Đang kết nối..." : "Kết nối ví SUI"}
          </button>

          {/* ===== STATUS MESSAGE ===== */}

          {status === "not-installed" && (
            <div className={styles.walletHint}>
              <p>❌ Chưa phát hiện ví SUI</p>

              <a
                href="https://chromewebstore.google.com/detail/suiet-wallet/khmnhcnbpipfhdldjhnadmgkgbhkjpph"
                target="_blank"
                rel="noopener noreferrer"
              >
                👉 Cài Suiet Wallet (Chrome)
              </a>

              <a
                href="https://chromewebstore.google.com/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil"
                target="_blank"
                rel="noopener noreferrer"
              >
                👉 Cài Sui Wallet chính thức
              </a>

              <a
                href="https://chromewebstore.google.com/detail/martian-wallet/efbglgofoippbgcjepnhiblaibcnclgk"
                target="_blank"
                rel="noopener noreferrer"
              >
                👉 Cài Martian Wallet
              </a>
            </div>
          )}

          {status === "locked" && (
            <div className={styles.walletHintWarn}>
              <p>🔒 Suiet đang bị khóa</p>
              <p>👉 Mở Suiet Wallet và nhập mật khẩu để unlock</p>
            </div>
          )}

          {status === "ready" && (
            <div className={styles.walletHint}>
              <p>✅ Suiet đã sẵn sàng</p>
              <p>
                👉 Nếu bấm mà không thấy popup, hãy nhìn góc phải
                thanh địa chỉ Chrome và cho phép popup
              </p>
            </div>
          )}
        </>
      )}

      {/* =====================
          ĐÃ CONNECT
      ===================== */}
      {user.wallet && (
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
            onClick={revokeWallet}
          >
            Gỡ ví
          </button>
        </>
      )}
    </div>
  );
}
