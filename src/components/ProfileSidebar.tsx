"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/styles/profileSidebar.module.css";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";

export default function ProfileSidebar() {
  const pathname = usePathname();
  const { data } = useSession();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className={styles.sidebar}>
      {/* USER */}
      <div className={styles.user}>
        <img
          src={data?.user?.image || ""}
          className={styles.avatar}
        />
        <p className={styles.userId}>
          mã số user: 21293810
        </p>
      </div>

      {/* MENU */}
      <nav className={styles.menu}>
        <Link
          href="/profile"
          className={isActive("/profile") ? styles.active : ""}
        >
          Membership
        </Link>

        <Link
          href="/profile/info"
          className={isActive("/profile/info") ? styles.active : ""}
        >
          Thông tin
        </Link>

        <Link
          href="/profile/history"
          className={isActive("/profile/history") ? styles.active : ""}
        >
          Lịch sử
        </Link>

        <Link
          href="/profile/settings"
          className={isActive("/profile/settings") ? styles.active : ""}
        >
          Cài đặt
        </Link>
      </nav>

      <button
        className={styles.logout}
        onClick={() => signOut()}
      >
        Đăng xuất
      </button>
    </aside>
  );
}
