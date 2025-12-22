"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/styles/admin/layout.module.css";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const nav = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/works", label: "Duyệt tác phẩm" },
    { href: "/admin/users", label: "Người dùng" },
    { href: "/admin/stats", label: "Thống kê" },
    { href: "/admin/logs", label: "Log duyệt" },
  ];

  return (
    <div className={styles.wrapper}>
      <aside className={styles.sidebar}>
        <h2 className={styles.title}>ADMIN</h2>

        <nav className={styles.nav}>
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={
                pathname === n.href
                  ? styles.active
                  : styles.link
              }
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className={styles.content}>{children}</main>
    </div>
  );
}
