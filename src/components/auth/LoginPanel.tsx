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
         Log in with Google to unlock more features.
        </p>

        <button
          className={styles.google}
          onClick={loginWithGoogle}
        >
          <span className={styles.icon}>G</span>
          Login Google
        </button>
      </div>

      {/* WALLET */}
      <div className={styles.col}>
        <h2>Author</h2>
        <p className={styles.desc}>
          Connect your wallet to log in to your author rights.
        </p>

        <button
          className={styles.wallet}
          onClick={connectWallet}
        >
          🔗 Connect Wallet
        </button>
      </div>
    </section>
  );
}