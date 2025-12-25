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
import { useEffect, useMemo, useState } from "react";
import { loadProfile, saveProfile } from "@/lib/profileStore";

/* ================= TYPES ================= */

type ProfileState = {
  name?: string;
  phone?: string;
  cccd?: string;
  birthday?: string; // ✅ LƯU ISO: yyyy-mm-dd
  country?: string;
  address?: string;
  walletAddress?: string;
};

const LAST_WALLET_KEY = "chainstorm_last_wallet";

/** ✅ decor image localStorage key */
function decorKey(userId: string) {
  return `chainstorm_wallet_decor:${userId || "guest"}`;
}

/* ================= DATE HELPERS (MASK + VALIDATE) ================= */

/** ISO (yyyy-mm-dd) -> dd/mm/yyyy */
function isoToDMY(iso?: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

/** Keep digits only, format to dd/mm/yyyy while typing */
function maskDMY(input: string) {
  const digits = (input || "").replace(/\D/g, "").slice(0, 8); // ddmmyyyy
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
  // format strict dd/mm/yyyy
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dmy)) {
    return { ok: false, reason: "Định dạng phải là dd/mm/yyyy" };
  }

  const [dS, mS, yS] = dmy.split("/");
  const d = Number(dS);
  const m = Number(mS);
  const y = Number(yS);

  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) {
    return { ok: false, reason: "Ngày không hợp lệ" };
  }

  // bạn có thể chỉnh range năm theo nhu cầu
  const nowY = new Date().getFullYear();
  if (y < 1900 || y > nowY + 1) {
    return { ok: false, reason: "Năm không hợp lệ" };
  }
  if (m < 1 || m > 12) {
    return { ok: false, reason: "Tháng phải từ 01 đến 12" };
  }
  const dim = daysInMonth(m, y);
  if (d < 1 || d > dim) {
    return { ok: false, reason: `Ngày phải từ 01 đến ${dim}` };
  }

  return { ok: true as const, reason: "" };
}

function dmyToISO(dmy: string) {
  const [dd, mm, yyyy] = dmy.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

/* ================= COMPONENT ================= */

export default function InfoTab() {
  const { user } = useAuth();
  const userId = user?.id || user?.email || "guest";

  /* ===== WALLET (CHUẨN MỚI) ===== */
  const currentAccount = useCurrentAccount();
  const { isConnected, currentWallet } = useCurrentWallet();
  const wallets = useWallets();
  const { mutateAsync: connect } = useConnectWallet();
  const { mutateAsync: disconnect } = useDisconnectWallet();
  const suiClient = useSuiClient();

  /* ===== PROFILE ===== */
  const [profile, setProfile] = useState<ProfileState>(() => loadProfile(userId));
  const [balance, setBalance] = useState("0");
  const [copied, setCopied] = useState(false);

  /* ===== BIRTHDAY UI STATE (dd/mm/yyyy) ===== */
  const [birthdayText, setBirthdayText] = useState(() => isoToDMY(loadProfile(userId)?.dob));

  // sync birthdayText when profile.birthday changes externally (e.g. load)
  useEffect(() => {
    setBirthdayText(isoToDMY(profile.birthday));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.birthday]);

  const birthdayValidation = useMemo(() => {
    if (!birthdayText) return { state: "idle" as const, msg: "Nhập theo định dạng dd/mm/yyyy" };
    if (birthdayText.length < 10) return { state: "idle" as const, msg: "Nhập đủ 8 số (ddmmyyyy)" };

    const v = validateDMY(birthdayText);
    if (!v.ok) return { state: "bad" as const, msg: v.reason };
    return { state: "ok" as const, msg: "" };
  }, [birthdayText]);

  /* ===== DECOR IMAGE (upload dưới nút disconnect) ===== */
  const [decorImg, setDecorImg] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(decorKey(userId)) || "";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    // keep in localStorage (persist refresh/logout)
    if (decorImg) localStorage.setItem(decorKey(userId), decorImg);
    else localStorage.removeItem(decorKey(userId));
  }, [decorImg, userId]);

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

    if (currentWallet?.name) {
      localStorage.setItem(LAST_WALLET_KEY, currentWallet.name);
    }
  }, [currentAccount, currentWallet]);

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

    const lastWalletName = localStorage.getItem(LAST_WALLET_KEY);
    if (!lastWalletName) return;

    const wallet = wallets.find((w) => w.name === lastWalletName);
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
    navigator.clipboard.writeText(currentAccount.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const disconnectWallet = async () => {
    localStorage.removeItem(LAST_WALLET_KEY);
    await disconnect();
  };

  /* =====================================================
     BIRTHDAY HANDLERS
  ===================================================== */

  const onBirthdayChange = (raw: string) => {
    const masked = maskDMY(raw);
    setBirthdayText(masked);

    // chỉ update profile.birthday khi đủ 10 ký tự và hợp lệ
    if (masked.length === 10) {
      const v = validateDMY(masked);
      if (v.ok) {
        setProfile((p) => ({
          ...p,
          birthday: dmyToISO(masked), // ✅ LƯU ISO
        }));
      }
    } else {
      // nếu đang gõ dở, đừng ghi đè ISO (tránh mất dữ liệu cũ)
      // bạn có thể chọn clear birthday nếu muốn:
      // setProfile((p) => ({ ...p, birthday: undefined }));
    }
  };

  const onBirthdayBlur = () => {
    if (!birthdayText) return;

    const masked = maskDMY(birthdayText);
    setBirthdayText(masked);

    if (masked.length !== 10) return;

    const v = validateDMY(masked);
    if (v.ok) {
      setProfile((p) => ({ ...p, birthday: dmyToISO(masked) }));
    }
  };

  /* =====================================================
     DECOR UPLOAD
  ===================================================== */

  const onPickDecor = (file?: File | null) => {
    if (!file) return;

    // ✅ giới hạn nhẹ (localStorage ~5MB)
    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file ảnh (png/jpg/webp)!");
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      alert("Ảnh quá lớn. Hãy chọn ảnh < 2.5MB để lưu được trong trình duyệt.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      setDecorImg(url);
    };
    reader.readAsDataURL(file);
  };

  const removeDecor = () => setDecorImg("");

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className={styles.infoGrid}>
      {/* ===== PROFILE ===== */}
      <section className={styles.card}>
        <h2>Thông tin cá nhân</h2>

        <div className={styles.formGrid}>
          <Field
            label="Họ và tên"
            value={profile.name}
            onChange={(v) => setProfile((p) => ({ ...p, name: v }))}
          />

          <Field
            label="Số điện thoại"
            value={profile.phone}
            onChange={(v) => setProfile((p) => ({ ...p, phone: v }))}
          />

          <Field
            label="Căn cước công dân"
            value={profile.cccd}
            onChange={(v) => setProfile((p) => ({ ...p, cccd: v }))}
          />

          {/* ✅ MASKED BIRTHDAY dd/mm/yyyy */}
          <Field
            label="Ngày sinh (dd/mm/yyyy)"
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
            hintTone={birthdayValidation.state} // idle | ok | bad
          />

          <Field label="Email" value={user?.email || ""} readOnly />

          <Field
            label="Quốc gia"
            value={profile.country}
            onChange={(v) => setProfile((p) => ({ ...p, country: v }))}
          />

          <FieldFull
            label="Địa chỉ"
            value={profile.address}
            onChange={(v) => setProfile((p) => ({ ...p, address: v }))}
          />
        </div>

        <div className={styles.autoSaveHint}>✔ Thông tin được lưu tự động</div>
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

            {/* ✅ DECOR UPLOAD BOX (persist localStorage) */}
            <div className={styles.decorWrap}>
              <div className={styles.decorHead}>
                <div>
                  <div className={styles.decorTitle}></div>
                  <div className={styles.decorSub}>
                  </div>
                </div>

                {decorImg ? (
                  <button className={styles.decorRemove} onClick={removeDecor} type="button">
                    Xoá
                  </button>
                ) : null}
              </div>

              <label className={styles.decorPick}>
                <input
                  type="file"
                  accept="image/*"
                  className={styles.decorInput}
                  onChange={(e) => onPickDecor(e.target.files?.[0])}
                />
                <span className={styles.decorPickBtn}>Chọn ảnh</span>
                <span className={styles.decorPickHint}>PNG/JPG/WebP • &lt; 2.5MB</span>
              </label>

              <div className={styles.decorFrame}>
                {decorImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.decorImg} src={decorImg} alt="decor" />
                ) : (
                  <div className={styles.decorEmpty}>
                    Chưa có ảnh • Upload để trang trí
                  </div>
                )}
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
      <input value={value ?? ""} onChange={onChange ? (e) => onChange(e.target.value) : undefined} />
    </div>
  );
}
