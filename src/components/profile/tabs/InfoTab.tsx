"use client";

import styles from "@/styles/profile.module.css";
import { useAuth } from "@/context/AuthContext";
import {
  useCurrentWallet,
  useSuiClient,
  useWallets,
  useConnectWallet,
  useDisconnectWallet,
} from "@mysten/dapp-kit";
import { useEffect, useState } from "react";
import { loadProfile, saveProfile } from "@/lib/profileStore";

export default function InfoTab() {
  const { user } = useAuth();
  const userId = user?.id || user?.email || "guest";

  const { currentAccount, isConnected } = useCurrentWallet();
  const wallets = useWallets();
  const { connect } = useConnectWallet();
  const { disconnect } = useDisconnectWallet();
  const suiClient = useSuiClient();

  const [profile, setProfile] = useState(() =>
    loadProfile(userId)
  );
  const [balance, setBalance] = useState("0");
  const [copied, setCopied] = useState(false);

  /* ===== AUTOSAVE ===== */
  useEffect(() => {
    const t = setTimeout(
      () => saveProfile(userId, profile),
      600
    );
    return () => clearTimeout(t);
  }, [profile, userId]);

  /* ===== LOAD BALANCE ===== */
  useEffect(() => {
    if (!currentAccount) return;
    suiClient
      .getBalance({ owner: currentAccount.address })
      .then((r) =>
        setBalance(
          (Number(r.totalBalance) / 1e9).toFixed(2)
        )
      );
  }, [currentAccount, suiClient]);

  const connectWallet = async () => {
    if (!wallets.length) {
      alert("Chưa cài ví SUI (Suiet / Martian)");
      return;
    }
    await connect({ wallet: wallets[0] });
  };

  const copyAddress = () => {
    if (!currentAccount) return;
    navigator.clipboard.writeText(
      currentAccount.address
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className={styles.infoGrid}>
      {/* ===== LEFT: PROFILE ===== */}
      <section className={styles.card}>
        <h2>Thông tin cá nhân</h2>

        <div className={styles.formGrid}>
          <Field label="Họ và tên" />
          <Field label="Số điện thoại" />
          <Field label="Căn cước công dân" />
          <Field label="Ngày sinh" type="date" />
          <Field label="Email" value={user?.email} disabled />
          <Field label="Quốc gia" />
          <FieldFull label="Địa chỉ" />
        </div>

        <div className={styles.autoSaveHint}>
          ✔ Thông tin được lưu tự động
        </div>
      </section>

      {/* ===== RIGHT: WALLET ===== */}
      <section className={styles.card}>
        <h2>Ví Blockchain SUI</h2>

        {!isConnected ? (
          <div className={styles.walletConnectBox}>
            <p>Bạn chưa kết nối ví SUI</p>

            <button
              className={styles.connectBtn}
              onClick={connectWallet}
            >
              Kết nối ví
            </button>
          </div>
        ) : (
          <div className={styles.walletBox}>
            <label>Địa chỉ ví</label>

            <div className={styles.walletRow}>
              <input
                value={currentAccount.address}
                disabled
              />
              <button
                className={styles.copyBtn}
                onClick={copyAddress}
              >
                {copied ? "✓" : "COPY"}
              </button>
            </div>

            <div className={styles.balanceBox}>
              <span>Số dư hiện tại</span>
              <strong>{balance} SUI</strong>
            </div>

            <button
              className={styles.disconnectBtn}
              onClick={disconnect}
            >
              Ngắt kết nối ví
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

/* ===== INPUT ===== */

function Field({
  label,
  value,
  disabled,
  type = "text",
}: any) {
  return (
    <div className={styles.formField}>
      <label>{label}</label>
      <input
        type={type}
        value={value || ""}
        disabled={disabled}
      />
    </div>
  );
}

function FieldFull({ label }: any) {
  return (
    <div className={styles.formFieldFull}>
      <label>{label}</label>
      <input />
    </div>
  );
}
