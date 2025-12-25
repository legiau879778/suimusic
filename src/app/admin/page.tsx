"use client";

import { useEffect, useState } from "react";
import { getUsers, subscribeUsers } from "@/lib/userStore";
import styles from "@/styles/admin/users.module.css";

export default function AdminUsersPage() {
  const [mounted, setMounted] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);

    const load = () => setUsers(getUsers());
    load();

    const unsub = subscribeUsers(load);
    return () => unsub();
  }, []);

  if (!mounted) return null;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Quản lý người dùng</h1>

      {users.length === 0 && <div className={styles.empty}>Chưa có người dùng</div>}

      <div className={styles.table}>
        <div className={styles.header}>
          <span>Email</span>
          <span>Role</span>
          <span>Wallet</span>
        </div>

        {users.map((u) => (
          <div key={u.id} className={styles.row}>
            <span>{u.email}</span>
            <span className={styles.role}>{u.role}</span>
            <span className={styles.wallet}>
              {u.wallet?.address ? u.wallet.address.slice(0, 10) + "…" : "—"}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
