"use client";

import { useEffect, useState } from "react";
import styles from "@/styles/admin/table.module.css";

import { getUsers, updateUserRole } from "@/lib/userStore";
import type { UserRole } from "@/context/AuthContext";

import {
  Crown,
  User,
  UserCircle,
} from "@phosphor-icons/react";

/* ================= COMPONENT ================= */

export default function UserTable() {
  const [users, setUsers] = useState(() => getUsers());

  /* ================= REALTIME ================= */
  useEffect(() => {
    const refresh = () => setUsers(getUsers());

    // same-tab (nếu bạn dispatch event trong userStore)
    window.addEventListener("users_updated", refresh);

    // cross-tab
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("users_updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  function changeRole(id: string, role: UserRole) {
    updateUserRole(id, role);
    setUsers(getUsers());
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h3>Quản lý người dùng</h3>
        <span className={styles.count}>{users.length} users</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Hành động</th>
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className={styles.emailCell}>
                  <UserCircle size={16} weight="duotone" />
                  {u.email}
                </td>

                <td>
                  <RoleBadge role={u.role} />
                </td>

                <td className={styles.actions}>
                  <button
                    className={`${styles.actionBtn} ${styles.adminBtn}`}
                    disabled={u.role === "admin"}
                    onClick={() => changeRole(u.id, "admin")}
                  >
                    <Crown size={14} /> Admin
                  </button>

                  <button
                    className={`${styles.actionBtn} ${styles.authorBtn}`}
                    disabled={u.role === "author"}
                    onClick={() => changeRole(u.id, "author")}
                  >
                    <User size={14} /> Author
                  </button>

                  <button
                    className={`${styles.actionBtn}`}
                    disabled={u.role === "user"}
                    onClick={() => changeRole(u.id, "user")}
                  >
                    User
                  </button>
                </td>
              </tr>
            ))}

            {users.length === 0 && (
              <tr>
                <td colSpan={3} className={styles.empty}>
                  Chưa có user nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= UI PARTS ================= */

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={`${styles.roleBadge} ${
        role === "admin"
          ? styles.roleAdmin
          : role === "author"
          ? styles.roleAuthor
          : styles.roleUser
      }`}
    >
      {role.toUpperCase()}
    </span>
  );
}
