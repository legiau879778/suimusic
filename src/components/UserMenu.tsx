"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { isAdminWallet } from "@/lib/adminWalletStore";
import styles from "@/styles/userMenu.module.css";

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* CLICK OUTSIDE */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );
    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
  }, []);

  if (!user) return null;

  const isAdmin = user.role === "admin";
  const hasAdminWallet =
    !!user.wallet && isAdminWallet(user.wallet);

  return (
    <div className={styles.wrapper} ref={ref}>
      {/* AVATAR */}
      <button
        className={styles.avatar}
        onClick={() => setOpen(!open)}
        aria-label="User menu"
      >
        {user.email[0].toUpperCase()}
      </button>

      {/* DROPDOWN */}
      {open && (
        <div className={styles.menu}>
          <Link href="/profile">Profile</Link>

          {/* ADMIN LINK */}
          {isAdmin && (
            <Link href="/admin">Admin</Link>
          )}

          {/* ADMIN ACTION STATE */}
          {isAdmin && !hasAdminWallet && (
            <div
              className={styles.disabled}
              title="Kết nối wallet admin để duyệt tác phẩm"
            >
              🔒 Chưa có quyền duyệt
            </div>
          )}

          <button
            className={styles.logout}
            onClick={logout}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
