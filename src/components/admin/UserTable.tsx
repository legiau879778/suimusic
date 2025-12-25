"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/styles/admin/users.module.css";

import { getUsers, subscribeUsers, updateUserRole } from "@/lib/userStore";
import type { UserRole } from "@/context/AuthContext";

import { Crown, User, UserCircle, CheckCircle } from "@phosphor-icons/react";

function shortAddr(a?: string) {
  if (!a) return "—";
  const v = String(a);
  if (v.length <= 14) return v;
  return `${v.slice(0, 8)}…${v.slice(-6)}`;
}

export default function UserTable({ query = "" }: { query?: string }) {
  // ✅ IMPORTANT: đừng đọc localStorage trong initial render (SSR -> [])
  const [mounted, setMounted] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);

    const refresh = () => setUsers(getUsers());
    refresh();

    const unsub = subscribeUsers(refresh);
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const k = query.trim().toLowerCase();
    if (!k) return users;

    return users.filter((u) => {
      const email = (u.email || "").toLowerCase();
      const role = (u.role || "").toLowerCase();
      const wallet = (u.wallet?.address || "").toLowerCase();
      return email.includes(k) || role.includes(k) || wallet.includes(k);
    });
  }, [users, query]);

  function changeRole(id: string, role: UserRole) {
    updateUserRole(id, role);
    setUsers(getUsers());
  }

  // ✅ tránh hydration mismatch: SSR render null, client mới render UI thật
  if (!mounted) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.tableHeader}>
        <div>
          <h3 className={styles.h3}>Users</h3>
          <div className={styles.meta}>
            <span>
              Tổng: <b>{users.length}</b>
            </span>
            <span>
              Hiển thị: <b>{filtered.length}</b>
            </span>
          </div>
        </div>
      </div>

      <div className={styles.gridTable}>
        <div className={`${styles.gridRow} ${styles.gridHead}`}>
          <div>Email</div>
          <div>Role</div>
          <div>Wallet</div>
          <div>Hành động</div>
        </div>

        {filtered.map((u) => (
          <div key={u.id} className={styles.gridRow}>
            <div className={styles.emailCell}>
              <UserCircle size={16} weight="duotone" />
              <span className={styles.emailText} title={u.email}>
                {u.email}
              </span>
            </div>

            <div className={styles.roleCell}>
              <RoleBadge role={u.role as UserRole} />
            </div>

            <div className={styles.walletCell}>
              <span className={styles.walletPill} title={u.wallet?.address || ""}>
                {u.wallet?.address ? shortAddr(u.wallet.address) : "—"}
              </span>
              {u.wallet?.verified ? (
                <span className={styles.verified} title="Wallet verified">
                  <CheckCircle size={16} weight="fill" />
                </span>
              ) : null}
            </div>

            <div className={styles.actions}>
              <button
                className={`${styles.actionBtn} ${styles.adminBtn}`}
                disabled={u.role === "admin"}
                onClick={() => changeRole(u.id, "admin")}
                type="button"
              >
                <Crown size={14} /> Admin
              </button>

              <button
                className={`${styles.actionBtn} ${styles.authorBtn}`}
                disabled={u.role === "author"}
                onClick={() => changeRole(u.id, "author")}
                type="button"
              >
                <User size={14} /> Author
              </button>

              <button
                className={styles.actionBtn}
                disabled={u.role === "user"}
                onClick={() => changeRole(u.id, "user")}
                type="button"
              >
                User
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>Không có kết quả</div>
            <div className={styles.emptySub}>Thử tìm theo email / role / wallet.</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={`${styles.rolePill} ${
        role === "admin" ? styles.roleAdmin : role === "author" ? styles.roleAuthor : styles.roleUser
      }`}
    >
      {role.toUpperCase()}
    </span>
  );
}
