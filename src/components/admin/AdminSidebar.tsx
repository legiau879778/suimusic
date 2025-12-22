"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/styles/admin/adminSidebar.module.css";

const MENU = [
  { href: "/admin", label: "Dashboard", icon: "fa-chart-pie" },
  { href: "/admin/works", label: "Duyệt tác phẩm", icon: "fa-file-signature" },
  { href: "/admin/logs", label: "Lịch sử duyệt", icon: "fa-clock-rotate-left" },
  { href: "/admin/users", label: "Người dùng", icon: "fa-users" },
  { href: "/admin/stats", label: "Thống kê", icon: "fa-chart-line" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <h2 className={styles.title}>ADMIN</h2>

      <nav className={styles.nav}>
        {MENU.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className={`${styles.item} ${
              pathname === m.href ? styles.active : ""
            }`}
          >
            <i className={`fa-solid ${m.icon}`} />
            <span>{m.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
