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
      // After user clicks connect, re-check status
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
      <h2>SUI Wallet</h2>

      {/* =====================
          NOT CONNECTED
      ===================== */}
      {!user.wallet && (
        <>
          <button
            className={styles.connectBtn}
            onClick={handleConnect}
            disabled={loading}
          >
            {loading ? "Connecting..." : "Connect SUI wallet"}
          </button>

          {/* ===== STATUS MESSAGE ===== */}

          {status === "not-installed" && (
            <div className={styles.walletHint}>
              <p>❌ SUI wallet not detected</p>

              <a
                href="https://chromewebstore.google.com/detail/suiet-wallet/khmnhcnbpipfhdldjhnadmgkgbhkjpph"
                target="_blank"
                rel="noopener noreferrer"
              >
                👉 Install Suiet Wallet (Chrome)
              </a>

              <a
                href="https://chromewebstore.google.com/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil"
                target="_blank"
                rel="noopener noreferrer"
              >
                👉 Install official Sui Wallet
              </a>

              <a
                href="https://chromewebstore.google.com/detail/martian-wallet/efbglgofoippbgcjepnhiblaibcnclgk"
                target="_blank"
                rel="noopener noreferrer"
              >
                👉 Install Martian Wallet
              </a>
            </div>
          )}

          {status === "locked" && (
            <div className={styles.walletHintWarn}>
              <p>🔒 Suiet is locked</p>
              <p>👉 Open Suiet Wallet and enter your password to unlock</p>
            </div>
          )}

          {status === "ready" && (
            <div className={styles.walletHint}>
              <p>✅ Suiet is ready</p>
              <p>
                👉 If you click and do not see a popup, check the right side
                of the Chrome address bar and allow popups
              </p>
            </div>
          )}
        </>
      )}

      {/* =====================
          CONNECTED
      ===================== */}
      {user.wallet && (
        <>
          <div className={styles.walletField}>
            <label>Wallet address</label>
            <input value={user.wallet.address} disabled />
          </div>

          <div className={styles.balanceBox}>
            <span>Balance</span>
            <strong>{balance.toFixed(4)} SUI</strong>
          </div>

          <button
            className={styles.revokeBtn}
            onClick={revokeWallet}
          >
            Disconnect wallet
          </button>
        </>
      )}
    </div>
  );
}
