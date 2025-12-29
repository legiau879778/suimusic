"use client";

import styles from "@/styles/profile.module.css";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadProfile, saveProfile, UserProfile } from "@/lib/profileStore";

type SocialKey = "twitter" | "facebook" | "instagram" | "website";

export default function SettingsTab() {
  const { user } = useAuth();
  const userId = user?.id || user?.email || "guest";

  const [profile, setProfile] = useState<UserProfile>(() => loadProfile(userId));
  const skipNextSaveRef = useRef(true);

  useEffect(() => {
    skipNextSaveRef.current = true;
    setProfile(loadProfile(userId));
  }, [userId]);

  /* ===== AUTOSAVE ===== */
  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    const t = setTimeout(() => saveProfile(userId, profile), 600);
    return () => clearTimeout(t);
  }, [profile, userId]);

  const socials = profile.socials || {};
  const options = profile.options || {};

  const setSocial = (k: SocialKey, v: string) =>
    setProfile({
      ...profile,
      socials: { ...socials, [k]: v },
    });

  const toggleOption = (k: keyof NonNullable<UserProfile["options"]>) =>
    setProfile({
      ...profile,
      options: {
        ...options,
        [k]: !options?.[k],
      },
    });

  return (
    <div className={styles.settingsWrap}>
      {/* ===== SOCIAL ===== */}
      <section className={styles.card}>
        <h2>Social Media</h2>

        <div className={styles.socialGrid}>
          <SocialField
            label="Twitter"
            kind="twitter"
            value={socials.twitter}
            placeholder="https://twitter.com/username"
            onChange={(v) => setSocial("twitter", v)}
          />
          <SocialField
            label="Facebook"
            kind="facebook"
            value={socials.facebook}
            placeholder="https://facebook.com/..."
            onChange={(v) => setSocial("facebook", v)}
          />
          <SocialField
            label="Instagram"
            kind="instagram"
            value={socials.instagram}
            placeholder="https://instagram.com/..."
            onChange={(v) => setSocial("instagram", v)}
          />
          <SocialField
            label="Website"
            kind="website"
            value={socials.website}
            placeholder="https://your-site.com"
            onChange={(v) => setSocial("website", v)}
          />
        </div>
      </section>

      {/* ===== OPTIONS ===== */}
      <section className={styles.card}>
        <h2>Profile Options</h2>

        <div className={styles.optionList}>
          <OptionRow
            label="Show public profile"
            desc="Allow others to view your profile"
            checked={!!options.publicProfile}
            onToggle={() => toggleOption("publicProfile")}
          />

          <OptionRow
            label="Show social media"
            desc="Show social media links on profile"
            checked={!!options.showSocials}
            onToggle={() => toggleOption("showSocials")}
          />

          <OptionRow
            label="Allow email contact"
            desc="Others can contact you via email"
            checked={!!options.allowEmailContact}
            onToggle={() => toggleOption("allowEmailContact")}
          />
        </div>

        <div className={styles.autoSaveHint}>✔ Settings are saved automatically</div>
      </section>
    </div>
  );
}

/* ================= SOCIAL FIELD ================= */

function SocialField({
  label,
  kind,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  kind: SocialKey;
  value?: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const v = value || "";

  const status = useMemo(() => {
    if (!v.trim()) return "empty" as const;
    return isValidUrl(v) ? ("ok" as const) : ("bad" as const);
  }, [v]);

  const helperText = useMemo(() => {
    if (status === "empty") return "Leave blank if you don't want to display";
    if (status === "ok") return "Valid";
    return "Link is not in correct format (should have https://)";
  }, [status]);

  const normalizeOnBlur = () => {
    const next = normalizeUrl(v);
    if (next !== v) onChange(next);
  };

  return (
    <div className={styles.socialField}>
      <div className={styles.socialLabelRow}>
        <span className={styles.socialLabel}>{label}</span>
        <span className={styles.socialLabelIcon} aria-hidden>
          {kind === "twitter" && <TwitterIcon />}
          {kind === "facebook" && <FacebookIcon />}
          {kind === "instagram" && <InstagramIcon />}
          {kind === "website" && <GlobeIcon />}
        </span>
      </div>

      <div className={styles.socialInputWrap}>
        <input
          value={v}
          placeholder={placeholder || `Enter ${label} link`}
          onChange={(e) => onChange(e.target.value)}
          onBlur={normalizeOnBlur}
          className={`${styles.socialInput} ${
            status === "ok" ? styles.inputOk : status === "bad" ? styles.inputBad : ""
          }`}
        />

        <span
          className={`${styles.socialStatus} ${
            status === "ok" ? styles.statusOk : status === "bad" ? styles.statusBad : styles.statusIdle
          }`}
          title={helperText}
        >
          {status === "ok" ? "✓" : status === "bad" ? "!" : "—"}
        </span>
      </div>

      <div
        className={`${styles.socialHint} ${
          status === "ok" ? styles.hintOk : status === "bad" ? styles.hintBad : styles.hintIdle
        }`}
      >
        {helperText}
      </div>
    </div>
  );
}

/* ================= OPTIONS ================= */

function OptionRow({
  label,
  desc,
  checked,
  onToggle,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={styles.optionRow}>
      <div>
        <strong>{label}</strong>
        <p>{desc}</p>
      </div>

      <button
        className={`${styles.toggle} ${checked ? styles.on : ""}`}
        onClick={onToggle}
        aria-label={checked ? "On" : "Off"}
        type="button"
      >
        <span />
      </button>
    </div>
  );
}

/* ================= HELPERS ================= */

function normalizeUrl(input: string) {
  const s = (input || "").trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  // nếu user nhập dạng "twitter.com/abc" -> tự thêm https://
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/?.*/.test(s)) return `https://${s}`;
  return s;
}

function isValidUrl(input: string) {
  const s = normalizeUrl(input);
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/* ================= ICONS (INLINE SVG) ================= */

function TwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M22 5.8c-.7.3-1.5.5-2.3.6.8-.5 1.4-1.2 1.7-2.1-.8.5-1.7.8-2.6 1A4 4 0 0 0 12 8.7a11.4 11.4 0 0 1-8.3-4.2 4 4 0 0 0 1.2 5.3c-.6 0-1.2-.2-1.7-.4v.1a4 4 0 0 0 3.2 3.9c-.5.1-1.1.1-1.6 0a4 4 0 0 0 3.7 2.8A8 8 0 0 1 2 18.1a11.3 11.3 0 0 0 6.3 1.8c7.6 0 11.7-6.4 11.7-11.9v-.5c.8-.6 1.4-1.2 2-2z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 8h2V5h-2c-2.2 0-4 1.8-4 4v3H8v3h2v7h3v-7h2.3l.7-3H13V9c0-.6.4-1 1-1z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="7" y="7" width="10" height="10" rx="3" />
      <path d="M16.5 7.5h.01" />
      <path d="M12 11a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
      <rect x="4" y="4" width="16" height="16" rx="5" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}
