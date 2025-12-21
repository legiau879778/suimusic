"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import styles from "@/styles/userMenu.module.css";
import { getCurrentUser } from "@/lib/authStore";

export default function UserMenu() {
  const { data } = useSession();
  const user = getCurrentUser();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  if (!data?.user) return null;

  return (
    <div className={styles.wrap} ref={ref}>
      <img
        src={data.user.image || ""}
        className={styles.avatar}
        onClick={() => setOpen((v) => !v)}
      />

      {open && (
        <div className={styles.menu}>
          <div className={styles.user}>
            <strong>{data.user.name}</strong>
            <span>{data.user.email}</span>
          </div>

          <Link href="/manage">Quản lý tác phẩm</Link>

          {user?.role === "admin" && (
            <Link href="/admin">Admin duyệt</Link>
          )}

          <button
            onClick={() => {
              signOut();
              setOpen(false);
            }}
          >
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
