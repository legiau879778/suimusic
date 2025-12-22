"use client";

import { useEffect, useState } from "react";
import styles from "@/styles/admin/table.module.css";
import { getUsers, setRole } from "@/lib/userStore";

export default function UserTable() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    setUsers(getUsers());
  }, []);

  const changeRole = (id: string, role: string) => {
    setRole(id, role as any);
    setUsers(getUsers());
  };

  return (
    <div className={styles.card}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th />
          </tr>
        </thead>

        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td className={styles.actions}>
                <button onClick={() => changeRole(u.id, "user")}>
                  User
                </button>
                <button onClick={() => changeRole(u.id, "author")}>
                  Author
                </button>
                <button onClick={() => changeRole(u.id, "admin")}>
                  Admin
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
