"use client";

import styles from "@/styles/profile.module.css";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import {
  loadProfile,
  saveProfile,
  UserProfile,
} from "@/lib/profileStore";

export default function SettingsTab() {
  const { user } = useAuth();
  const userId = user?.id || user?.email || "guest";

  const [profile, setProfile] = useState<UserProfile>(
    () => loadProfile(userId)
  );

  /* ===== AUTOSAVE ===== */
  useEffect(() => {
    const t = setTimeout(
      () => saveProfile(userId, profile),
      600
    );
    return () => clearTimeout(t);
  }, [profile, userId]);

  const socials = profile.socials || {};
  const options = profile.options || {};

  const setSocial = (k: string, v: string) =>
    setProfile({
      ...profile,
      socials: { ...socials, [k]: v },
    });

  const toggleOption = (k: string) =>
    setProfile({
      ...profile,
      options: {
        ...options,
        [k]: !options[k as keyof typeof options],
      },
    });

  return (
    <div className={styles.settingsWrap}>
      {/* ===== SOCIAL ===== */}
      <section className={styles.card}>
        <h2>Mạng xã hội</h2>

        <div className={styles.socialGrid}>
          <SocialField
            label="Twitter"
            value={socials.twitter}
            onChange={(v) => setSocial("twitter", v)}
          />
          <SocialField
            label="Facebook"
            value={socials.facebook}
            onChange={(v) =>
              setSocial("facebook", v)
            }
          />
          <SocialField
            label="Instagram"
            value={socials.instagram}
            onChange={(v) =>
              setSocial("instagram", v)
            }
          />
          <SocialField
            label="Website"
            value={socials.website}
            onChange={(v) =>
              setSocial("website", v)
            }
          />
        </div>
      </section>

      {/* ===== OPTIONS ===== */}
      <section className={styles.card}>
        <h2>Tùy chọn hồ sơ</h2>

        <div className={styles.optionList}>
          <OptionRow
            label="Hiển thị hồ sơ công khai"
            desc="Cho phép người khác xem hồ sơ của bạn"
            checked={!!options.publicProfile}
            onToggle={() =>
              toggleOption("publicProfile")
            }
          />

          <OptionRow
            label="Hiển thị mạng xã hội"
            desc="Hiển thị link mạng xã hội trên hồ sơ"
            checked={!!options.showSocials}
            onToggle={() =>
              toggleOption("showSocials")
            }
          />

          <OptionRow
            label="Cho phép liên hệ qua email"
            desc="Người khác có thể liên hệ bạn qua email"
            checked={!!options.allowEmailContact}
            onToggle={() =>
              toggleOption("allowEmailContact")
            }
          />
        </div>

        <div className={styles.autoSaveHint}>
          ✔ Cài đặt được lưu tự động
        </div>
      </section>
    </div>
  );
}

/* ===== SUB COMPONENTS ===== */

function SocialField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className={styles.socialField}>
      <label>{label}</label>
      <input
        value={value || ""}
        placeholder={`Nhập link ${label}`}
        onChange={(e) =>
          onChange(e.target.value)
        }
      />
    </div>
  );
}

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
        className={`${styles.toggle} ${
          checked ? styles.on : ""
        }`}
        onClick={onToggle}
      >
        <span />
      </button>
    </div>
  );
}
