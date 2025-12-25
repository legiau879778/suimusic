"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/login.module.css";

import {
  loginWithEmail,
  loginWithGoogle,
} from "@/services/auth.service";

type Mode = "user" | "author";

export default function LoginPage() {
  /* ================== STATE ================== */
  const [mode, setMode] = useState<Mode>("user");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const router = useRouter();

  /* ================== HANDLERS ================== */

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (emailError) setEmailError("");
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (passwordError) setPasswordError("");
  };

  const handleUserLogin = async () => {
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

    try {
      await loginWithEmail(email, password);
      router.push("/");
    } catch {
      setPasswordError("Email hoặc mật khẩu không đúng");
    }
  };

  /* ========= GOOGLE LOGIN ========= */

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      router.push("/");
    } catch (err) {
      console.error(err);
      setPasswordError("Đăng nhập Google thất bại");
    }
  };

  const handleAuthorLogin = async () => {
    try {
      await loginWithGoogle();
      router.push("/manage");
    } catch (err: any) {
      console.log("🔥 GOOGLE ERROR:", err?.code, err?.message);
      setPasswordError("Đăng nhập Google thất bại");
    }
  };

  /* ================== RENDER ================== */

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        {/* LEFT */}
        <div className={styles.left}>
          <h1>Đăng nhập</h1>
          <p>Truy cập hệ thống Chainstorm</p>
        </div>

        {/* RIGHT */}
        <div className={styles.right}>
          {/* MODE SWITCH */}
          <div className={styles.switch}>
            <button
              className={mode === "user" ? styles.active : ""}
              onClick={() => setMode("user")}
            >
              Người dùng
            </button>
            <button
              className={mode === "author" ? styles.active : ""}
              onClick={() => setMode("author")}
            >
              Tác giả
            </button>
          </div>

          {/* USER LOGIN */}
          {mode === "user" && (
            <>
              <div className={styles.field}>
                <label>Email</label>
                <input
                  value={email}
                  onChange={(e) =>
                    handleEmailChange(e.target.value)
                  }
                />
                {emailError && (
                  <span className={styles.error}>
                    {emailError}
                  </span>
                )}
              </div>

              <div className={styles.field}>
                <label>Mật khẩu</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) =>
                    handlePasswordChange(e.target.value)
                  }
                />
                {passwordError && (
                  <span className={styles.error}>
                    {passwordError}
                  </span>
                )}
              </div>

              <button
                className={styles.submit}
                onClick={handleUserLogin}
              >
                Đăng nhập
              </button>
              <button
                className={styles.submit}
                onClick={handleGoogleLogin}
              >
                Đăng nhập bằng Google
              </button>
            </>
          )}

          {/* AUTHOR LOGIN */}
          {mode === "author" && (
            <>
              <p className={styles.walletHint}>
                Đăng nhập tác giả bằng Google
              </p>

              <button
                className={styles.submit}
                onClick={handleAuthorLogin}
              >
                Đăng nhập Google (Tác giả)
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
