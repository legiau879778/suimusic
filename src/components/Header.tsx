"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useLoginModal } from "@/context/LoginModalContext";
import UserMenu from "@/components/UserMenu";
import styles from "@/styles/header.module.css";

export default function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { openLogin } = useLoginModal();

  const [hidden, setHidden] = useState(false);
  const [lastY, setLastY] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastY && y > 80) setHidden(true);
      else setHidden(false);
      setLastY(y);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () =>
      window.removeEventListener("scroll", onScroll);
  }, [lastY]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header
      className={`${styles.header} ${
        hidden ? styles.hidden : ""
      }`}
    >
      <Link href="/" className={styles.logo}>
        <span>⚡</span>
        <strong>CHAINSTORM</strong>
      </Link>

      <nav className={styles.nav}>
        <Link href="/" className={isActive("/") ? styles.active : ""}>
          Trang chủ
        </Link>
        <Link
          href="/search"
          className={isActive("/search") ? styles.active : ""}
        >
          Tra cứu
        </Link>
        <Link
          href="/manage"
          className={isActive("/manage") ? styles.active : ""}
        >
          Quản lý
        </Link>
        <Link
          href="/trade"
          className={isActive("/trade") ? styles.active : ""}
        >
          Giao dịch
        </Link>
      </nav>

      <div className={styles.auth}>
        {!session ? (
          <button onClick={openLogin} className={styles.login}>
            Đăng nhập
          </button>
        ) : (
          <UserMenu />
        )}
      </div>
    </header>
  );
}
