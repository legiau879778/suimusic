"use client";

import React from "react";
import styles from "@/styles/profile.module.css";

export type Tab = "info" | "membership" | "history" | "settings";

type Props = {
  active: Tab;
  onChange: React.Dispatch<React.SetStateAction<Tab>>;
};

export default function ProfileSidebar({ active, onChange }: Props) {
  const Item = ({ id, label, icon }: { id: Tab; label: string; icon: string }) => (
    <button
      type="button"
      className={`${styles.navItem} ${active === id ? styles.navActive : ""}`}
      onClick={() => onChange(id)}
    >
      <span className={styles.navIcon}>{icon}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarTop}>
        <div className={styles.avatarCircle}>👤</div>
        <div className={styles.sidebarName}>Tài khoản</div>
        <div className={styles.sidebarSub}>Quản lý hồ sơ</div>
      </div>

      <nav className={styles.nav}>
        <Item id="info" label="Thông tin" icon="👤" />
        <Item id="membership" label="Membership" icon="💎" />
        <Item id="history" label="Lịch sử" icon="🧾" />
        <Item id="settings" label="Cài đặt" icon="⚙️" />
      </nav>
    </aside>
  );
}
