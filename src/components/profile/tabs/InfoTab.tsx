"use client";

import styles from "@/styles/profile.module.css";
import { useAuth } from "@/context/AuthContext";
import {
  useCurrentAccount,
  useSuiClient,
  useWallets,
  useConnectWallet,
  useDisconnectWallet,
} from "@mysten/dapp-kit";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { loadProfile, saveProfile } from "@/lib/profileStore";
import QRCode from "qrcode";
import { useToast } from "@/context/ToastContext";

import { db } from "@/lib/firebase"; 
import { doc, updateDoc } from "firebase/firestore";

/* ================= HELPERS ================= */
type ProfileState = {
  name?: string; phone?: string; cccd?: string;
  birthday?: string; country?: string; address?: string;
};

function isoToDMY(iso?: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return (y && m && d) ? `${d}/${m}/${y}` : "";
}

function maskDMY(input: string) {
  const digits = (input || "").replace(/\D/g, "").slice(0, 8);
  const dd = digits.slice(0, 2), mm = digits.slice(2, 4), yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

function validateDMY(dmy: string) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dmy)) return { ok: false, reason: "Use dd/mm/yyyy format" };
  const [dS, mS, yS] = dmy.split("/");
  const d = Number(dS), m = Number(mS), y = Number(yS);
  const nowY = new Date().getFullYear();
  if (y < 1900 || y > nowY + 1) return { ok: false, reason: "Invalid year" };
  if (m < 1 || m > 12) return { ok: false, reason: "Month must be 01-12" };
  const dim = new Date(y, m, 0).getDate();
  if (d < 1 || d > dim) return { ok: false, reason: `Day must be 01-${dim}` };
  return { ok: true as const, reason: "" };
}

function dmyToISO(dmy: string) {
  const [dd, mm, yyyy] = dmy.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

function shortAddr(a?: string) {
  if (!a) return "—";
  return a.length <= 14 ? a : `${a.slice(0, 6)}…${a.slice(-6)}`;
}

function InternalQR({ value, size = 180, className }: { value: string; size?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current && value) {
      QRCode.toCanvas(ref.current, value, { width: size, margin: 1 }).catch(() => {});
    }
  }, [value, size]);
  return <canvas ref={ref} className={className} />;
}

/* ================= MAIN COMPONENT ================= */
export default function InfoTab() {
  const { user, refresh } = useAuth(); // Refresh để cập nhật context sau khi lưu Firebase
  const { pushToast } = useToast();
  const userId = user?.id || "guest";
  const internalWalletAddress = user?.internalWallet?.address || "";

  const currentAccount = useCurrentAccount();
  const wallets = useWallets();
  const { mutate: connect } = useConnectWallet();
  const { mutate: disconnect } = useDisconnectWallet();
  const suiClient = useSuiClient();

  const [balance, setBalance] = useState("0.000");
  const [copiedExternal, setCopiedExternal] = useState(false);
  const [copiedInternal, setCopiedInternal] = useState(false);

  // --- LOGIC ĐỒNG BỘ VÍ ---
  const storageKey = useMemo(() => user?.id ? `wallet_active_${user.id}` : null, [user?.id]);
  const [isManualConnected, setIsManualConnected] = useState(false);

  useEffect(() => {
    const checkSync = () => {
      if (storageKey) setIsManualConnected(localStorage.getItem(storageKey) === "true");
    };
    checkSync();
    window.addEventListener("storage", checkSync);
    const id = setInterval(checkSync, 1000); 
    return () => { window.removeEventListener("storage", checkSync); clearInterval(id); };
  }, [storageKey]);

  const activeAddress = (isManualConnected && currentAccount) ? currentAccount.address : "";
  const isConnected = !!activeAddress;

  // --- LẤY SỐ DƯ ---
  useEffect(() => {
    if (!activeAddress) { setBalance("0.000"); return; }
    const fetchBalance = async () => {
      try {
        const r = await suiClient.getBalance({ owner: activeAddress, coinType: "0x2::sui::SUI" });
        setBalance((Number(r.totalBalance) / 1e9).toFixed(3));
      } catch (e) { setBalance("0.000"); }
    };
    fetchBalance();
    const id = setInterval(fetchBalance, 15000);
    return () => clearInterval(id);
  }, [activeAddress, suiClient]);

  // --- PROFILE STATE ---
  const [profile, setProfile] = useState<ProfileState>(() => {
    const p: any = loadProfile(userId) || {};
    return { ...p, birthday: p.birthday || p.dob };
  });
  const [birthdayText, setBirthdayText] = useState(() => isoToDMY(profile.birthday));
  const [isEditing, setIsEditing] = useState(false);

  const copyToClipboard = (text: string, setFlag: (v: boolean) => void, message: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setFlag(true);
    setTimeout(() => setFlag(false), 1200);
    pushToast("success", message);
  };

  // --- KẾT NỐI VÀ LƯU FIREBASE ---
  const handleConnect = () => {
    if (!storageKey) return;
    if (wallets.length === 0) {
      pushToast("warning", "Please install Slush wallet");
      return;
    }

    connect({ wallet: wallets[0] }, {
      onSuccess: async (wallet) => {
        const address = wallet.accounts[0]?.address;
        
        // 1. Lưu local state
        localStorage.setItem(storageKey, "true");
        setIsManualConnected(true);

        // 2. Lưu vào Firebase Firestore
        if (address && user?.id) {
          try {
            const userRef = doc(db, "users", user.id); // Giả định collection tên là 'users'
            await updateDoc(userRef, {
              walletAddress: address, // Lưu ví Slush vào field walletAddress
              lastConnected: new Date().toISOString()
            });
            
            pushToast("success", "Wallet connected and saved");
            if (refresh) await refresh(); // Cập nhật lại Auth Context để nhận ví mới
          } catch (error) {
            console.error("Lỗi Firebase:", error);
            pushToast("warning", "Wallet connected, but failed to save");
          }
        }
      }
    });
  };

  const handleDisconnect = () => {
    if (storageKey) {
      localStorage.removeItem(storageKey);
      setIsManualConnected(false);
      disconnect();
      pushToast("warning", "Disconnected");
    }
  };

  const birthdayValidation = useMemo(() => {
    if (!birthdayText) return { state: "idle", msg: "" };
    if (birthdayText.length < 10) return { state: "idle", msg: "" };
    const v = validateDMY(birthdayText);
    return v.ok ? { state: "ok", msg: "" } : { state: "bad", msg: v.reason };
  }, [birthdayText]);

  const handleSaveProfile = () => {
    saveProfile(userId, { ...profile, dob: profile.birthday });
    setIsEditing(false);
    pushToast("success", "Profile saved");
  };

  return (
    <div className={styles.infoGrid2}>
      <section className={styles.card}>
        <h2>Personal information</h2>
        <div className={styles.formGrid}>
          <Field label="Full name" value={profile.name} readOnly={!isEditing} onChange={(v: string) => setProfile(p => ({ ...p, name: v }))} />
          <Field label="Phone number" value={profile.phone} readOnly={!isEditing} onChange={(v: string) => setProfile(p => ({ ...p, phone: v }))} />
          <Field label="National ID" value={profile.cccd} readOnly={!isEditing} onChange={(v: string) => setProfile(p => ({ ...p, cccd: v }))} />
          <Field 
            label="Date of birth"
            value={birthdayText}
            readOnly={!isEditing}
            placeholder="dd/mm/yyyy"
            onChange={(v: string) => {
              const m = maskDMY(v); setBirthdayText(m);
              if (m.length === 10 && validateDMY(m).ok) setProfile(p => ({ ...p, birthday: dmyToISO(m) }));
            }}
            className={birthdayValidation.state === "bad" ? styles.inputBad : birthdayValidation.state === "ok" ? styles.inputOk : ""}
            hint={birthdayValidation.state === "bad" ? birthdayValidation.msg : ""} hintTone={birthdayValidation.state as any}
          />
          <Field label="Verified email" value={user?.email || ""} readOnly />
          <Field label="Country" value={profile.country} readOnly={!isEditing} onChange={(v: string) => setProfile(p => ({ ...p, country: v }))} />
          <FieldFull label="Contact address" value={profile.address} readOnly={!isEditing} onChange={(v: string) => setProfile(p => ({ ...p, address: v }))} />
        </div>
        <div className={styles.formActions}>
          <button className={styles.ghostBtn} onClick={() => setIsEditing(true)} disabled={isEditing}>
            Edit
          </button>
          <button className={styles.primaryBtn} onClick={handleSaveProfile} disabled={!isEditing}>
            Save
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeaderFlex}>
          <h2>Blockchain wallet (Testnet)</h2>
          <span className={isConnected ? styles.externalTag : styles.internalTag}>
            {isConnected ? "Slush wallet active" : "Not connected"}
          </span>
        </div>

        <div className={styles.walletStack}>
          <label>Active wallet address (Slush)</label>
          <div className={styles.walletRow}>
            <input value={activeAddress} readOnly className={styles.addressInput} placeholder="Connect Slush wallet..." />
            <button className={styles.copyBtn} onClick={() => copyToClipboard(activeAddress, setCopiedExternal, "Address copied")} disabled={!isConnected}>
              {copiedExternal ? "Copied" : "Copy"}
            </button>
          </div>
          <div className={styles.balanceBox}>
            <span>Current balance (Testnet)</span>
            <strong style={{ color: '#f1c40f' }}>{balance} SUI</strong>
          </div>
          <div className={styles.walletActions}>
            {!isConnected ? <button className={styles.connectBtn} onClick={handleConnect}>Connect Slush wallet</button> : <button className={styles.disconnectBtn} onClick={handleDisconnect}>Disconnect</button>}
          </div>

          <div className={styles.qrWrap}>
            <div className={styles.qrHeader}>
              <div className={styles.qrTitle}>Heritage ID</div>
              <div className={styles.qrSub}>Scan the internal wallet address</div>
            </div>
            <div className={styles.qrGrid}>
              <div className={styles.qrMeta}>
                <div className={`${styles.qrMetaRow} ${styles.qrMetaRowStack}`}>
                  <span>Internal wallet</span>
                  <div className={styles.qrMetaValueRow}>
                    <strong className={styles.qrMono}>{shortAddr(internalWalletAddress)}</strong>
                    <button className={styles.copyBtn} style={{ padding: '2px 8px', fontSize: '10px', height: 'auto', minWidth: 'auto' }} onClick={() => copyToClipboard(internalWalletAddress, setCopiedInternal, "Internal wallet copied")}>
                      {copiedInternal ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
                <div className={styles.qrMetaRow}><span>User ID</span><strong className={styles.qrMono}>{userId.slice(0, 8)}...</strong></div>
              </div>
              <div className={styles.qrBox}><InternalQR value={internalWalletAddress} className={styles.qrCanvas} /></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, readOnly, placeholder, className, hint, hintTone = "idle" }: any) {
  return (
    <div className={styles.formField}>
      <label>{label}</label>
      <input value={value ?? ""} readOnly={readOnly} placeholder={placeholder} className={className} onChange={(e) => onChange?.(e.target.value)} />
      {hint ? <div className={`${styles.fieldHint} ${styles['hint' + hintTone]}`}>{hint}</div> : null}
    </div>
  );
}
function FieldFull({ label, value, onChange, readOnly }: any) {
  return ( <div className={styles.formFieldFull}><label>{label}</label><input value={value ?? ""} readOnly={readOnly} onChange={(e) => onChange?.(e.target.value)} /></div> );
}

