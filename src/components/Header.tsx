"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import styles from "@/styles/Header.module.css";

export default function Header() {
  const { user, logout, loading } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) return null; // ⛔ tránh render sớm

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>
        🎵 Chainstorm
      </Link>

      <nav className={styles.nav}>
        <Link href="/search">Tra cứu tác giả</Link>

        {!user && <Link href="/login">Đăng nhập</Link>}

        {user && (
          <div className={styles.avatarWrap}>
            <div
              className={styles.avatar}
              onClick={() => setOpen(!open)}
            >
              {user.username[0].toUpperCase()}
            </div>

            {open && (
              <div className={styles.menu}>
                <Link href="/profile">Profile</Link>
                <Link href="/settings">Settings</Link>
                <button onClick={logout}>Logout</button>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
