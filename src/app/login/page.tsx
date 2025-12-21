"use client";

/*
  FIXED:
  - No setState inside useEffect
  - No hook order issue
  - ESLint clean (react-hooks/set-state-in-effect)
*/

import styles from "@/styles/login.module.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login as loginUser } from "@/lib/authStore";

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

  const handleUserLogin = () => {
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

    loginUser(email);
    router.push("/");
  };

  const handleAuthorLogin = () => {
    // giả lập connect wallet
    loginUser("author@wallet");
    router.push("/manage");
  };

  /* ================== RENDER ================== */

  return (
    <div className={styles.page}>
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
            </>
          )}

          {/* AUTHOR LOGIN */}
          {mode === "author" && (
            <>
              <p className={styles.walletHint}>
                Kết nối ví để đăng nhập với tư cách tác giả
              </p>

              <button
                className={styles.submit}
                onClick={handleAuthorLogin}
              >
                Kết nối ví
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
