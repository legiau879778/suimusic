"use client";

import styles from "@/styles/profile.module.css";

const TABS = [
  { key: "info", label: "Thông tin cá nhân" },
  { key: "membership", label: "Membership" },
  { key: "history", label: "Lịch sử giao dịch" },
  { key: "settings", label: "Cài đặt" },
];

export default function ProfileTabs({
  active,
  onChange,
}: {
  active: string;
  onChange: (k: string) => void;
}) {
  return (
    <div className={styles.tabColumn}>
      {TABS.map(t => (
        <button
          key={t.key}
          className={`${styles.tabItem} ${
            active === t.key ? styles.active : ""
          }`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
