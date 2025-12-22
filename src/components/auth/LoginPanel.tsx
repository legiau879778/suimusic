"use client";

import { useState } from "react";
import styles from "@/app/login/login.module.css";
import { useAuth } from "@/context/AuthContext";

export default function LoginPanel() {
  const { loginWithGoogle, connectWallet } = useAuth();
  const [mode, setMode] = useState<"user" | "author">("user");

  return (
    <section
      className={`${styles.panel} ${
        mode === "author" ? styles.author : ""
      }`}
    >
      {/* GOOGLE */}
      <div className={styles.col}>
        <h2>User</h2>
        <p className={styles.desc}>
          Đăng nhập bằng Google để mở khóa thêm chức năng.
        </p>

        <button
          className={styles.google}
          onClick={loginWithGoogle}
        >
          <span className={styles.icon}>G</span>
          Đăng nhập Google
        </button>
      </div>

      {/* WALLET */}
      <div className={styles.col}>
        <h2>Author</h2>
        <p className={styles.desc}>
          Kết nối ví để đăng nhập quyền tác giả của bạn.
        </p>

        <button
          className={styles.wallet}
          onClick={connectWallet}
        >
          🔗 Kết nối Wallet
        </button>
      </div>
    </section>
  );
}
