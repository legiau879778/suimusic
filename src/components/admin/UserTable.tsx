"use client";

import { getUsers, updateUserRole } from "@/lib/userStore";
import styles from "@/styles/admin/table.module.css";
import { useState } from "react";

export default function UserTable() {
  const [users, setUsers] = useState(getUsers());

  function changeRole(id: string, role: any) {
    updateUserRole(id, role);
    setUsers([...getUsers()]);
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Email</th>
          <th>Role</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        {users.map(u => (
          <tr key={u.id}>
            <td>{u.email}</td>
            <td>{u.role}</td>
            <td>
              <button onClick={() => changeRole(u.id, "admin")}>
                Set Admin
              </button>
              <button onClick={() => changeRole(u.id, "author")}>
                Set Author
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
