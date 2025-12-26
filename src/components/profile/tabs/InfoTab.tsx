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
import React, { useEffect, useMemo, useRef, useState } from "react";
import { loadProfile, saveProfile } from "@/lib/profileStore";
import { mapWalletToEmail } from "@/lib/walletMapStore";
import QRCode from "qrcode";

/* ================= TYPES ================= */

type ProfileState = {
  name?: string;
  phone?: string;
  cccd?: string;
  birthday?: string; // ISO yyyy-mm-dd
  country?: string;
  address?: string;
  walletAddress?: string;
};

const lastWalletKey = (userId: string) => `chainstorm_last_wallet:${userId}`;

/* ================= DATE HELPERS (MASK + VALIDATE) ================= */

function isoToDMY(iso?: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

function maskDMY(input: string) {
  const digits = (input || "").replace(/\D/g, "").slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);

  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

function isLeapYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(m: number, y: number) {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  if ([4, 6, 9, 11].includes(m)) return 30;
  return 31;
}

function validateDMY(dmy: string) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dmy)) {
    return { ok: false, reason: "Format must be dd/mm/yyyy" };
  }

  const [dS, mS, yS] = dmy.split("/");
  const d = Number(dS);
  const m = Number(mS);
  const y = Number(yS);

  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) {
    return { ok: false, reason: "Invalid date" };
  }

  const nowY = new Date().getFullYear();
  if (y < 1900 || y > nowY + 1) return { ok: false, reason: "Invalid year" };
  if (m < 1 || m > 12) return { ok: false, reason: "Month must be 01 to 12" };

  const dim = daysInMonth(m, y);
  if (d < 1 || d > dim) return { ok: false, reason: `Day must be 01 to ${dim}` };

  return { ok: true as const, reason: "" };
}

function dmyToISO(dmy: string) {
  const [dd, mm, yyyy] = dmy.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

function shortAddr(a?: string) {
  if (!a) return "—";
  const v = String(a);
  if (v.length <= 14) return v;
  return `${v.slice(0, 6)}…${v.slice(-6)}`;
}

/* ================= QR CANVAS ================= */

function InternalQR({
  value,
  size = 200,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    // avoid drawing QR when value is empty
    if (!value) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
    }).catch(() => {});
  }, [value, size]);

  return <canvas ref={ref} width={size} height={size} className={className} />;
}

/* ================= COMPONENT ================= */

export default function InfoTab() {
  const { user } = useAuth();
  const userId = user?.id || user?.email || "guest";

  /* ===== WALLET ===== */
  const currentAccount = useCurrentAccount();
  const { isConnected, currentWallet } = useCurrentWallet();
  const wallets = useWallets();
  const { mutateAsync: connect } = useConnectWallet();
  const { mutateAsync: disconnect } = useDisconnectWallet();
  const suiClient = useSuiClient();

  /* ===== PROFILE (compat birthday/dob) ===== */
  const [profile, setProfile] = useState<ProfileState>(() => {
    const p: any = loadProfile(userId) || {};
    return {
      name: p.name,
      phone: p.phone,
      cccd: p.cccd,
      birthday: p.birthday || p.dob,
      country: p.country,
      address: p.address,
      walletAddress: p.walletAddress,
    };
  });

  const [balance, setBalance] = useState("0");
  const [copied, setCopied] = useState(false);

  /* ===== BIRTHDAY UI STATE ===== */
  const [birthdayText, setBirthdayText] = useState(() => isoToDMY(profile.birthday));

  useEffect(() => {
    setBirthdayText(isoToDMY(profile.birthday));
  }, [profile.birthday]);

  const birthdayValidation = useMemo(() => {
    if (!birthdayText) return { state: "idle" as const, msg: "Enter in dd/mm/yyyy format" };
    if (birthdayText.length < 10) return { state: "idle" as const, msg: "Enter 8 digits (ddmmyyyy)" };

    const v = validateDMY(birthdayText);
    if (!v.ok) return { state: "bad" as const, msg: v.reason };
    return { state: "ok" as const, msg: "" };
  }, [birthdayText]);

  /* =====================================================
     AUTO SAVE PROFILE (DEBOUNCE)
  ===================================================== */
  useEffect(() => {
    const t = setTimeout(() => {
      const payload: any = { ...profile, dob: profile.birthday };
      saveProfile(userId, payload);
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

    if (currentWallet?.name) {
      localStorage.setItem(lastWalletKey(userId), currentWallet.name);
    }
    if (user?.email) {
      mapWalletToEmail(user.email, currentAccount.address);
    }
  }, [currentAccount, currentWallet, user?.email, userId]);

  /* =====================================================
     LOAD BALANCE
  ===================================================== */
  useEffect(() => {
    if (!currentAccount?.address) return;

    suiClient
      .getBalance({ owner: currentAccount.address })
      .then((r) => setBalance((Number(r.totalBalance) / 1e9).toFixed(2)))
      .catch(() => setBalance("0"));
  }, [currentAccount, suiClient]);

  /* =====================================================
     AUTO RECONNECT WALLET
  ===================================================== */
  useEffect(() => {
    if (isConnected) return;
    if (!wallets.length) return;

    const lastWalletName = localStorage.getItem(lastWalletKey(userId));
    if (!lastWalletName) return;

    const wallet = wallets.find((w) => w.name === lastWalletName);
    if (!wallet) return;

    connect({ wallet }).catch(() => {
      localStorage.removeItem(lastWalletKey(userId));
      localStorage.removeItem("chainstorm_last_wallet");
    });
  }, [wallets, isConnected, connect, userId]);

  /* =====================================================
     ACTIONS
  ===================================================== */

  const connectWallet = async () => {
    if (!wallets.length) {
      alert("SUI wallet not installed (Suiet / Martian)");
      return;
    }
    await connect({ wallet: wallets[0] });
  };

  const copyAddress = () => {
    if (!currentAccount?.address) return;
    navigator.clipboard.writeText(currentAccount.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const disconnectWallet = async () => {
    localStorage.removeItem(lastWalletKey(userId));
    localStorage.removeItem("chainstorm_last_wallet");
    await disconnect();
  };

  /* =====================================================
     BIRTHDAY HANDLERS
  ===================================================== */

  const onBirthdayChange = (raw: string) => {
    const masked = maskDMY(raw);
    setBirthdayText(masked);

    if (masked.length === 10) {
      const v = validateDMY(masked);
      if (v.ok) {
        setProfile((p) => ({ ...p, birthday: dmyToISO(masked) }));
      }
    }
  };

  const onBirthdayBlur = () => {
    if (!birthdayText) return;
    const masked = maskDMY(birthdayText);
    setBirthdayText(masked);

    if (masked.length !== 10) return;
    const v = validateDMY(masked);
    if (v.ok) setProfile((p) => ({ ...p, birthday: dmyToISO(masked) }));
  };

  /* =====================================================
     INTERNAL QR PAYLOAD
  ===================================================== */

  const internalQRValue = useMemo(() => {
    const wallet = currentAccount?.address || profile.walletAddress || "";
    return `CHAINSTORM|USER:${userId}|WALLET:${wallet}`;
  }, [userId, currentAccount?.address, profile.walletAddress]);

  /* =====================================================
     RENDER (Figma-ish: left info, right wallet + QR)
  ===================================================== */

  return (
    <div className={styles.infoGrid2}>
      {/* LEFT: PROFILE */}
      <section className={styles.card}>
        <h2>Personal info</h2>

        <div className={styles.formGrid}>
          <Field
            label="Full name"
            value={profile.name}
            onChange={(v) => setProfile((p) => ({ ...p, name: v }))}
          />

          <Field
            label="Phone number"
            value={profile.phone}
            onChange={(v) => setProfile((p) => ({ ...p, phone: v }))}
          />

          <Field
            label="ID number"
            value={profile.cccd}
            onChange={(v) => setProfile((p) => ({ ...p, cccd: v }))}
          />

          <Field
            label="Date of birth (dd/mm/yyyy)"
            value={birthdayText}
            placeholder="dd/mm/yyyy"
            inputMode="numeric"
            maxLength={10}
            onChange={onBirthdayChange}
            onBlur={onBirthdayBlur}
            className={
              birthdayValidation.state === "bad"
                ? styles.inputBad
                : birthdayValidation.state === "ok"
                ? styles.inputOk
                : ""
            }
            hint={birthdayValidation.msg}
            hintTone={birthdayValidation.state}
          />

          <Field label="Email" value={user?.email || ""} readOnly />

          <Field
            label="Country"
            value={profile.country}
            onChange={(v) => setProfile((p) => ({ ...p, country: v }))}
          />

          <FieldFull
            label="Address"
            value={profile.address}
            onChange={(v) => setProfile((p) => ({ ...p, address: v }))}
          />
        </div>

        <div className={styles.autoSaveHint}>✔ Info is saved automatically</div>
      </section>

      {/* RIGHT: WALLET */}
      <section className={styles.card}>
        <h2>SUI blockchain wallet</h2>

        {!isConnected || !currentAccount ? (
          <div className={styles.walletConnectBox}>
            <p>You have not connected a SUI wallet</p>
            <button className={styles.connectBtn} onClick={connectWallet} type="button">
              Connect wallet
            </button>

            {/* Internal QR still shows for user identification */}
            <div className={styles.qrWrap}>
              <div className={styles.qrHeader}>
                <div className={styles.qrTitle}>Internal QR</div>
                <div className={styles.qrSub}>Identify account in the system</div>
              </div>

              <div className={styles.qrGrid}>
                <div className={styles.qrMeta}>
                  <div className={styles.qrMetaRow}>
                    <span>Internal ID</span>
                    <strong className={styles.qrMono}>{String(userId)}</strong>
                  </div>
                  <div className={styles.qrMetaRow}>
                    <span>Wallet</span>
                    <strong className={styles.qrMono}>—</strong>
                  </div>
                </div>

                <div className={styles.qrBox}>
                  <InternalQR value={internalQRValue} className={styles.qrCanvas} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.walletStack}>
            <label>Wallet address</label>

            <div className={styles.walletRow}>
              <input value={currentAccount.address} readOnly />
              <button className={styles.copyBtn} onClick={copyAddress} type="button">
                {copied ? "✓" : "COPY"}
              </button>
            </div>

            <div className={styles.balanceBox}>
              <span>Current balance</span>
              <strong>{balance} SUI</strong>
            </div>

            <button className={styles.disconnectBtn} onClick={disconnectWallet} type="button">
              Disconnect wallet
            </button>

            {/* Internal QR + info */}
            <div className={styles.qrWrap}>
              <div className={styles.qrHeader}>
                <div className={styles.qrTitle}>Internal QR</div>
                <div className={styles.qrSub}>Scan to get user + wallet</div>
              </div>

              <div className={styles.qrGrid}>
                <div className={styles.qrMeta}>
                  <div className={styles.qrMetaRow}>
                    <span>Wallet</span>
                    <strong>{currentWallet?.name || "SUI Wallet"}</strong>
                  </div>
                  <div className={styles.qrMetaRow}>
                    <span>Internal ID</span>
                    <strong className={styles.qrMono}>{String(userId)}</strong>
                  </div>
                  <div className={styles.qrMetaRow}>
                    <span>Short address</span>
                    <strong className={styles.qrMono}>{shortAddr(currentAccount.address)}</strong>
                  </div>
                </div>

                <div className={styles.qrBox}>
                  <InternalQR value={internalQRValue} className={styles.qrCanvas} />
                </div>
              </div>

              <div className={styles.qrFootNote}>
                Payload: <span className={styles.qrMono}>{internalQRValue}</span>
              </div>
            </div>
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
  onBlur,
  readOnly,
  type = "text",
  placeholder,
  inputMode,
  maxLength,
  className,
  hint,
  hintTone = "idle",
}: {
  label: string;
  value?: string;
  type?: string;
  readOnly?: boolean;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  className?: string;
  hint?: string;
  hintTone?: "idle" | "ok" | "bad";
  onChange?: (v: string) => void;
  onBlur?: () => void;
}) {
  return (
    <div className={styles.formField}>
      <label>{label}</label>
      <input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        readOnly={readOnly}
        className={className}
        onBlur={onBlur}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      />

      {hint ? (
        <div
          className={`${styles.fieldHint} ${
            hintTone === "ok"
              ? styles.hintOk
              : hintTone === "bad"
              ? styles.hintBad
              : styles.hintIdle
          }`}
        >
          {hint}
        </div>
      ) : null}
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
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      />
    </div>
  );
}
