"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import styles from "@/styles/admin/sidebar.module.css";

export default function AdminSidebar() {
  const { user } = useAuth();

  if (!user || !["admin", "super_admin"].includes(user.role)) return null;

  return (
    <aside className={styles.sidebar}>
      <Link href="/admin">Dashboard</Link>
      <Link href="/admin/review">Duyệt tác phẩm</Link>
      <Link href="/admin/logs">Logs</Link>

      {user.role === "super_admin" && (
        <>
          <hr />
          <Link href="/admin/quorum">Quorum</Link>
          <Link href="/admin/admins">Admins</Link>
        </>
      )}
    </aside>
  );
}
