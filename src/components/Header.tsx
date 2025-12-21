"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import UserMenu from "./UserMenu";
import styles from "@/styles/header.module.css";

export default function Header() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const go = (href: string) => {
    if (!user) router.push("/login");
    else router.push(href);
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className={styles.header}>
      {/* LOGO */}
      <Link href="/" className={styles.logo}>
        <Image
          src="/images/logo.png"
          alt="Chainstorm"
          width={34}
          height={34}
          priority
        />
        <span className={styles.logoText}>CHAINSTORM</span>
      </Link>

      {/* MENU */}
      <nav className={styles.nav}>
        <Link href="/" className={isActive("/") ? styles.active : ""}>
          Trang chủ
        </Link>

        <button
          onClick={() => go("/manage")}
          className={isActive("/manage") ? styles.active : ""}
        >
          Quản lý tác phẩm
        </button>

        <Link
          href="/search"
          className={isActive("/search") ? styles.active : ""}
        >
          Tra cứu tác phẩm
        </Link>

        <button
          onClick={() => go("/register-work")}
          className={isActive("/register-work") ? styles.active : ""}
        >
          Đăng ký tác phẩm
        </button>

        <button
          onClick={() => go("/trade")}
          className={isActive("/trade") ? styles.active : ""}
        >
          Giao dịch bản quyền
        </button>
      </nav>

      {/* RIGHT */}
      <div className={styles.right}>
        {user ? (
          <UserMenu />
        ) : (
          <Link href="/login" className={styles.loginIcon} aria-label="Đăng nhập">
            <i className="fa-solid fa-user"></i>
          </Link>
        )}
      </div>
    </header>
  );
}
