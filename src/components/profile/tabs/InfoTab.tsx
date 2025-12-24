"use client";

import styles from "@/styles/profile.module.css";
import { useAuth } from "@/context/AuthContext";
import {
  useCurrentAccount,
  useCurrentWallet,
  useSuiClient,
  useWallets,
  useConnectWallet,
  useDisconnectWallet,
} from "@mysten/dapp-kit";
import { useEffect, useState } from "react";
import { loadProfile, saveProfile } from "@/lib/profileStore";

/* ================= TYPES ================= */

type ProfileState = {
  name?: string;
  phone?: string;
  cccd?: string;
  birthday?: string;
  country?: string;
  address?: string;
  walletAddress?: string;
};

const LAST_WALLET_KEY = "chainstorm_last_wallet";

/* ================= COMPONENT ================= */

export default function InfoTab() {
  const { user } = useAuth();
  const userId = user?.id || user?.email || "guest";

  /* ===== WALLET (CHUẨN MỚI) ===== */
  const currentAccount = useCurrentAccount();
  const { isConnected, currentWallet } = useCurrentWallet(); // ✅ lấy wallet instance
  const wallets = useWallets();
  const { mutateAsync: connect } = useConnectWallet();
  const { mutateAsync: disconnect } = useDisconnectWallet();
  const suiClient = useSuiClient();

  /* ===== PROFILE ===== */
  const [profile, setProfile] = useState<ProfileState>(
    () => loadProfile(userId)
  );

  const [balance, setBalance] = useState("0");
  const [copied, setCopied] = useState(false);

  /* =====================================================
     AUTO SAVE PROFILE (DEBOUNCE)
  ===================================================== */

  useEffect(() => {
    const t = setTimeout(() => {
      saveProfile(userId, profile);
    }, 600);
    return () => clearTimeout(t);
  }, [profile, userId]);

  /* =====================================================
     SAVE WALLET ADDRESS + WALLET NAME
  ===================================================== */

  useEffect(() => {
    if (!currentAccount?.address) return;

    setProfile((p) => ({
      ...p,
      walletAddress: currentAccount.address,
    }));

    // ✅ LƯU TÊN WALLET ĐÚNG CÁCH
    if (currentWallet?.name) {
      localStorage.setItem(
        LAST_WALLET_KEY,
        currentWallet.name
      );
    }
  }, [currentAccount, currentWallet]);

  /* =====================================================
     LOAD BALANCE
  ===================================================== */

  useEffect(() => {
    if (!currentAccount?.address) return;

    suiClient
      .getBalance({ owner: currentAccount.address })
      .then((r) => {
        setBalance(
          (Number(r.totalBalance) / 1e9).toFixed(2)
        );
      })
      .catch(() => setBalance("0"));
  }, [currentAccount, suiClient]);

  /* =====================================================
     AUTO RECONNECT WALLET
  ===================================================== */

  useEffect(() => {
    if (isConnected) return;
    if (!wallets.length) return;

    const lastWalletName =
      localStorage.getItem(LAST_WALLET_KEY);

    if (!lastWalletName) return;

    const wallet = wallets.find(
      (w) => w.name === lastWalletName
    );

    if (!wallet) return;

    connect({ wallet }).catch(() => {
      localStorage.removeItem(LAST_WALLET_KEY);
    });
  }, [wallets, isConnected, connect]);

  /* =====================================================
     ACTIONS
  ===================================================== */

  const connectWallet = async () => {
    if (!wallets.length) {
      alert("Chưa cài ví SUI (Suiet / Martian)");
      return;
    }
    await connect({ wallet: wallets[0] });
  };

  const copyAddress = () => {
    if (!currentAccount?.address) return;

    navigator.clipboard.writeText(
      currentAccount.address
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const disconnectWallet = async () => {
    localStorage.removeItem(LAST_WALLET_KEY);
    await disconnect();
  };

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className={styles.infoGrid}>
      {/* ===== PROFILE ===== */}
      <section className={styles.card}>
        <h2>Thông tin cá nhân</h2>

        <div className={styles.formGrid}>
          <Field label="Họ và tên" value={profile.name}
            onChange={(v) => setProfile((p) => ({ ...p, name: v }))} />

          <Field label="Số điện thoại" value={profile.phone}
            onChange={(v) => setProfile((p) => ({ ...p, phone: v }))} />

          <Field label="Căn cước công dân" value={profile.cccd}
            onChange={(v) => setProfile((p) => ({ ...p, cccd: v }))} />

          <Field label="Ngày sinh" type="date" value={profile.birthday}
            onChange={(v) => setProfile((p) => ({ ...p, birthday: v }))} />

          <Field label="Email" value={user?.email || ""} readOnly />

          <Field label="Quốc gia" value={profile.country}
            onChange={(v) => setProfile((p) => ({ ...p, country: v }))} />

          <FieldFull label="Địa chỉ" value={profile.address}
            onChange={(v) => setProfile((p) => ({ ...p, address: v }))} />
        </div>

        <div className={styles.autoSaveHint}>
          ✔ Thông tin được lưu tự động
        </div>
      </section>

      {/* ===== WALLET ===== */}
      <section className={styles.card}>
        <h2>Ví Blockchain SUI</h2>

        {!isConnected || !currentAccount ? (
          <div className={styles.walletConnectBox}>
            <p>Bạn chưa kết nối ví SUI</p>
            <button className={styles.connectBtn} onClick={connectWallet}>
              Kết nối ví
            </button>
          </div>
        ) : (
          <div className={styles.walletBox}>
            <label>Địa chỉ ví</label>

            <div className={styles.walletRow}>
              <input value={currentAccount.address} readOnly />
              <button className={styles.copyBtn} onClick={copyAddress}>
                {copied ? "✓" : "COPY"}
              </button>
            </div>

            <div className={styles.balanceBox}>
              <span>Số dư hiện tại</span>
              <strong>{balance} SUI</strong>
            </div>

            <button className={styles.disconnectBtn} onClick={disconnectWallet}>
              Ngắt kết nối ví
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

/* ================= INPUT COMPONENTS ================= */

function Field({
  label,
  value,
  onChange,
  readOnly,
  type = "text",
}: {
  label: string;
  value?: string;
  type?: string;
  readOnly?: boolean;
  onChange?: (v: string) => void;
}) {
  return (
    <div className={styles.formField}>
      <label>{label}</label>
      <input
        type={type}
        value={value ?? ""}
        readOnly={readOnly}
        onChange={
          onChange ? (e) => onChange(e.target.value) : undefined
        }
      />
    </div>
  );
}

function FieldFull({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <div className={styles.formFieldFull}>
      <label>{label}</label>
      <input
        value={value ?? ""}
        onChange={
          onChange ? (e) => onChange(e.target.value) : undefined
        }
      />
    </div>
  );
}
