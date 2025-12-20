"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import styles from "@/styles/form.module.css";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");

  const submit = () => {
    if (!username) return alert("Nhập username");

    login({
      username,
      role: username === "admin" ? "admin" : "user",
    });

    router.push("/");
  };

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Đăng nhập</h1>

      <input
        className={styles.input}
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <button className={styles.primary} onClick={submit}>
        Đăng nhập
      </button>
    </div>
  );
}
