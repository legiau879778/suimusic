"use client";

// UPDATED: public search, protected private routes

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "@/styles/header.module.css";
import { useAuth } from "@/context/AuthContext";
import UserMenu from "./UserMenu";

const PRIVATE_ROUTES = ["/manage", "/trade", "/register-work"];

export default function Header() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragX, setDragX] = useState(0);

  const lastScroll = useRef(0);
  const startX = useRef(0);

  /* SCROLL BEHAVIOR */
  useEffect(() => {
    const onScroll = () => {
      const current = window.scrollY;
      setScrolled(current > 20);

      if (current > lastScroll.current && current > 120) {
        setHidden(true);
      } else {
        setHidden(false);
      }

      lastScroll.current = current;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ROUTE GUARD */
  const go = (href: string) => {
    setMenuOpen(false);

    const isPrivate = PRIVATE_ROUTES.some((r) =>
      href.startsWith(r)
    );

    if (isPrivate && !user) {
      router.push("/login");
    } else {
      router.push(href);
    }
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  /* SWIPE */
  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientX - startX.current;
    if (delta > 0) setDragX(delta);
  };

  const onTouchEnd = () => {
    if (dragX > 80) setMenuOpen(false);
    setDragX(0);
  };

  return (
    <>
      <header
        className={[
          styles.header,
          scrolled ? styles.scrolled : "",
          hidden ? styles.hidden : "",
        ].join(" ")}
      >
        <div className={styles.inner}>
          {/* LOGO */}
          <Link href="/" className={styles.logo}>
            <Image
              src="/images/logo.png"
              alt="Chainstorm"
              width={32}
              height={32}
              priority
            />
            <span>CHAINSTORM</span>
          </Link>

          {/* DESKTOP NAV */}
          <nav className={styles.nav}>
            <Link href="/" className={isActive("/") ? styles.active : ""}>
              Trang chủ
            </Link>

            {/* PUBLIC */}
            <Link
              href="/search"
              className={isActive("/search") ? styles.active : ""}
            >
              Tra cứu
            </Link>

            {/* PRIVATE */}
            <button onClick={() => go("/manage")}>Quản lý</button>
            <button onClick={() => go("/trade")}>Giao dịch</button>
          </nav>

          {/* RIGHT */}
          <div className={styles.right}>
            {user ? (
              <UserMenu />
            ) : (
              <button
                className={styles.login}
                onClick={() => router.push("/login")}
              >
                Đăng nhập
              </button>
            )}

            <button
              className={styles.menuToggle}
              onClick={() => setMenuOpen(true)}
            >
              ☰
            </button>
          </div>
        </div>
      </header>

      {/* OVERLAY */}
      {menuOpen && (
        <div
          className={styles.overlay}
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* MOBILE MENU */}
      <aside
        className={`${styles.mobileMenu} ${
          menuOpen ? styles.open : ""
        }`}
        style={{ transform: `translateX(${menuOpen ? dragX : 100}%)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <button
          className={styles.close}
          onClick={() => setMenuOpen(false)}
        >
          ✕
        </button>

        {/* PUBLIC */}
        <Link href="/" onClick={() => setMenuOpen(false)}>
          Trang chủ
        </Link>
        <Link href="/search" onClick={() => setMenuOpen(false)}>
          Tra cứu
        </Link>

        {/* PRIVATE */}
        <button onClick={() => go("/manage")}>Quản lý</button>
        <button onClick={() => go("/trade")}>Giao dịch</button>

        {!user && (
          <button
            className={styles.mobileLogin}
            onClick={() => router.push("/login")}
          >
            Đăng nhập
          </button>
        )}
      </aside>
    </>
  );
}
