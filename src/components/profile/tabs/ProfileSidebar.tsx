"use client";

import styles from "@/styles/profile.module.css";
import { useAuth } from "@/context/AuthContext";

const items = [
  { id: "membership", label: "Membership", icon: "fa-id-card" },
  { id: "info", label: "Thông tin", icon: "fa-user" },
  { id: "history", label: "Lịch sử", icon: "fa-clock" },
  { id: "settings", label: "Cài đặt", icon: "fa-gear" },
];

export default function ProfileSidebar({
  active,
  onChange,
}: {
  active: string;
  onChange: (v: any) => void;
}) {
  const { logout, user } = useAuth();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.avatarBlock}>
        <div className={styles.avatarCircle}>
          {user?.email?.[0]?.toUpperCase()}
        </div>
        <span className={styles.userId}>
          mã số user: {user?.id || "—"}
        </span>
      </div>

      <nav className={styles.sideNav}>
        {items.map((i) => (
          <button
            key={i.id}
            onClick={() => onChange(i.id)}
            className={`${styles.sideBtn} ${
              active === i.id ? styles.sideActive : ""
            }`}
          >
            <i className={`fa-solid ${i.icon}`} />
            {i.label}
          </button>
        ))}
      </nav>

      <button className={styles.logoutBtn} onClick={logout}>
        Đăng xuất
      </button>
    </aside>
  );
}
