"use client";

import { useMemo, useState } from "react";
import styles from "@/styles/admin/users.module.css";
import UserTable from "@/components/admin/UserTable";
import { UsersThree } from "@phosphor-icons/react";

export default function AdminUsersPage() {
  const [q, setQ] = useState("");

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.titleBlock}>
          <div className={styles.iconWrap} aria-hidden="true">
            <UsersThree size={18} weight="duotone" />
          </div>
          <div>
            <h1 className={styles.title}>User management</h1>
            <p className={styles.sub}>List loaded from localStorage key: <b>chainstorm_users</b></p>
          </div>
        </div>

        <div className={styles.right}>
          <input
            className={styles.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email / role / wallet..."
          />
        </div>
      </div>

      <div className={styles.card}>
        <UserTable query={q} />
      </div>
    </main>
  );
}
