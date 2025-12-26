"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "@/styles/userMenu.module.css";

import { useAuth } from "@/context/AuthContext";
import { isAdminWallet } from "@/lib/adminWalletStore";

export default function UserMenu() {
  const { user, logout } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  /* =========================
     CLICK OUTSIDE TO CLOSE
  ========================= */
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClick);
    return () =>
      document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) return null;

  const isAdmin = user.role === "admin";

  // IMPORTANT FIX:
  // isAdminWallet only accepts string (address), NOT WalletInfo
  const hasAdminWallet =
    !!user.wallet && isAdminWallet(user.wallet.address || "");

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={styles.avatar}
        onClick={() => setOpen(o => !o)}
      >
        {user.email.charAt(0).toUpperCase()}
      </button>

      {open && (
        <div className={styles.menu}>
          <div className={styles.userInfo}>
            <strong>{user.email}</strong>
            <span className={styles.role}>
              {user.role === "admin"
                ? "Admin"
                : user.role === "author"
                ? "Author"
                : "User"}
            </span>
          </div>

          <hr />

          <Link href="/profile">Profile</Link>

          {isAdmin && hasAdminWallet && (
            <Link href="/admin">Admin Dashboard</Link>
          )}

          <button
            className={styles.logout}
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
