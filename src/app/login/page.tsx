"use client";

import LoginPanel from "@/components/auth/LoginPanel";
import styles from "./login.module.css";

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.bg} />
      <LoginPanel />
    </main>
  );
}
