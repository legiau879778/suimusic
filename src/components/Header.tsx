"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import UserMenu from "./UserMenu";
import styles from "@/styles/Header.module.css";

export default function Header() {
  const { user } = useAuth();
  const router = useRouter();

  const go = (href: string) => {
    if (!user) {
      router.push("/login");
    } else {
      router.push(href);
    }
  };

  return (
    <header className={styles.header}>
      {/* ===== LOGO IMAGE ===== */}
      <Link href="/" className={styles.logo}>
        <Image
          src="/images/logo.png"
          alt="Chainstorm"
          width={36}
          height={36}
          priority
        />
        <span className={styles.logoText}></span>
      </Link>

      {/* ===== MENU ===== */}
      <nav className={styles.nav}>
        <Link href="/">Trang chủ</Link>
        <Link href="/search">Tra cứu tác giả</Link>

        {/* USER MENU */}
        <button onClick={() => go("/manage")}>
          Quản lý tác phẩm
        </button>

        <button onClick={() => go("/register-work")}>
          Đăng ký tác phẩm
        </button>

        <button onClick={() => go("/trade")}>
          Giao dịch
        </button>

        {/* ===== ADMIN ONLY ===== */}
        {user?.role === "admin" && (
          <Link href="/admin" className={styles.admin}>
            Admin
          </Link>
        )}
      </nav>


      {/* ===== USER ===== */}
      {user ? (
        <UserMenu />
      ) : (
        <Link href="/login" className={styles.login}>
          Đăng nhập
        </Link>
      )}
    </header>
  );
}
