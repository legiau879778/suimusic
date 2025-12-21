"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "@/styles/login.module.css";

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"user" | "author">("user");

  // user login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  /* ===== AUTO CLEAR ERROR ===== */
  useEffect(() => {
    if (email) setEmailError("");
  }, [email]);

  useEffect(() => {
    if (password) setPasswordError("");
  }, [password]);

  /* ===== HANDLERS ===== */
  const submitUser = () => {
    let hasError = false;
    if (!email) {
      setEmailError("Vui lòng nhập email");
      hasError = true;
    }
    if (!password) {
      setPasswordError("Vui lòng nhập mật khẩu");
      hasError = true;
    }
    if (hasError) return;

    alert("User login (email/password)");
  };

  const connectWallet = () => {
    alert("Connect wallet (Metamask / WalletConnect)");
    // TODO: wallet connect logic
  };

  return (
    <div className={styles.page}>
      <div className={styles.bg} />

      <div
        className={`${styles.panel} ${
          mode === "author" ? styles.authorMode : styles.userMode
        }`}
      >
        {/* LEFT */}
        <div className={styles.left}>
          {mode === "user" && (
            <>
              <h1>ĐĂNG NHẬP</h1>

              <div className={styles.inputWrap}>
                <input
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
                {emailError && (
                  <span className={styles.errorText}>{emailError}</span>
                )}
              </div>

              <div className={styles.inputWrap}>
                <input
                  type="password"
                  placeholder="Mật khẩu"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                {passwordError && (
                  <span className={styles.errorText}>{passwordError}</span>
                )}
              </div>

              <button className={styles.primaryBtn} onClick={submitUser}>
                Đăng nhập
              </button>

              <p className={styles.register}>
                Chưa có tài khoản? <Link href="/register">Đăng ký</Link>
              </p>
            </>
          )}

          {mode === "author" && (
            <button
              className={styles.backBtn}
              onClick={() => setMode("user")}
            >
              ← Quay lại đăng nhập user
            </button>
          )}
        </div>

        {/* RIGHT */}
        <div className={styles.right}>
          {mode === "user" && (
            <div className={styles.authorRow}>
              <button
                className={styles.switchBtn}
                onClick={() => setMode("author")}
              >
                Đăng nhập tác giả
              </button>

              <button className={styles.googleIcon}>
                <i className="fa-brands fa-google" />
              </button>
            </div>
          )}

          {mode === "author" && (
            <>
              <div className={styles.rightTitle}>
                Đăng nhập tác giả
              </div>

              <button
                className={styles.walletBtn}
                onClick={connectWallet}
              >
                <i className="fa-brands fa-ethereum" />
                Connect Wallet
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
