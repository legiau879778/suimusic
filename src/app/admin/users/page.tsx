"use client";

import styles from "@/styles/admin/users.module.css";
import UserTable from "@/components/admin/UserTable";

export default function AdminUsersPage() {
  return (
    <main className={styles.page}>
      <UserTable />
    </main>
  );
}
