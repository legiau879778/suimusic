"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "@/styles/header.module.css";
import { useAuth } from "@/context/AuthContext";
import { useModal } from "@/context/ModalContext";
import { saveRedirect } from "@/lib/redirect";
import { canAccessMenu } from "@/lib/membershipGuard";
import { getActiveMembership } from "@/lib/membershipStore";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { openLogin, openPermission } = useModal();

  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [animateAvatar, setAnimateAvatar] = useState(false);
  const [lastScroll, setLastScroll] = useState(0);

  const [membership, setMembership] = useState(getActiveMembership());
  const [countdown, setCountdown] = useState("");

  /* ===== HEADER AUTO HIDE ===== */
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastScroll && y > 80) setHidden(true);
      else setHidden(false);
      setLastScroll(y);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [lastScroll]);

  /* ===== AVATAR POP ===== */
  useEffect(() => {
    if (user) {
      setAnimateAvatar(true);
      const t = setTimeout(() => setAnimateAvatar(false), 900);
      return () => clearTimeout(t);
    }
  }, [user?.id]);

  /* ===== MEMBERSHIP COUNTDOWN ===== */
  useEffect(() => {
    if (!membership) return;

    const tick = () => {
      const diff = membership.expireAt - Date.now();
      if (diff <= 0) {
        setMembership(null);
        setCountdown("");
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(`${d}d ${h}h ${m}m`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [membership]);

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`${styles.link} ${pathname === href ? styles.active : ""}`}
    >
      {label}
    </Link>
  );

  const navProtected = (
    href: string,
    label: string,
    perm: "manage" | "register" | "trade"
  ) => (
    <div className={styles.navItemWrap}>
      <button
        className={styles.link}
        onClick={() => {
          if (!user) {
            saveRedirect();
            openLogin();
            return;
          }
          if (!canAccessMenu(perm)) {
            saveRedirect();
            openPermission();
            return;
          }
          router.push(href);
        }}
      >
        {label}
      </button>

      {!canAccessMenu(perm) && (
        <div
          className={styles.lockWrap}
          onClick={(e) => {
            e.stopPropagation();
            saveRedirect();
            !user ? openLogin() : openPermission();
          }}
        >
          <LockIcon />
          <div className={styles.tooltip}>Yêu cầu Membership phù hợp</div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <header className={`${styles.header} ${hidden ? styles.hidden : ""}`}>
        {/* ===== LOGO ONLY (BỎ CHỮ) ===== */}
        <Link href="/" className={styles.logo}>
          <Image
            src="/images/logo.png"
            alt="Chainstorm"
            width={40}
            height={40}
            priority
          />
        </Link>

        <nav className={styles.nav}>
          {navLink("/", "Trang chủ")}
          {navLink("/search", "Tra cứu")}
          {navProtected("/manage", "Quản lý tác phẩm", "manage")}
          {navProtected("/register-work", "Đăng ký", "register")}
          {navProtected("/trade", "Giao dịch tác phẩm", "trade")}
          {user?.role === "admin" && navLink("/admin", "Admin")}
        </nav>

        <div className={styles.actions}>
          {!user ? (
            <button
              className={styles.loginBtn}
              onClick={() => {
                saveRedirect();
                openLogin();
              }}
            >
              Đăng nhập
            </button>
          ) : (
            <div className={styles.avatarWrap}>
              <button
                className={`${styles.avatar} ${styles[user.role]} ${
                  animateAvatar ? styles.avatarPop : ""
                }`}
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt="avatar"
                    referrerPolicy="no-referrer"
                    className={styles.avatarImg}
                  />
                ) : (
                  user.email[0].toUpperCase()
                )}
              </button>

              {/* ===== BADGE MEMBERSHIP ===== */}
              {membership && (
                <span
                  className={`${styles.membershipBadge} ${
                    styles[membership.type]
                  }`}
                >
                  {membership.type === "creator"
                    ? membership.plan?.toUpperCase()
                    : membership.type.toUpperCase()}
                </span>
              )}

              {/* ===== COUNTDOWN ===== */}
              {membership && countdown && (
                <div className={styles.membershipCountdown}>
                  Hết hạn sau {countdown}
                </div>
              )}

              <div className={styles.avatarTooltip}>{user.email}</div>

              {userMenuOpen && (
                <div className={`${styles.dropdown} ${styles.open}`}>
                  <Link href="/profile">Hồ sơ</Link>
                  <button onClick={logout}>Đăng xuất</button>
                </div>
              )}
            </div>
          )}

          <button
            className={styles.menuToggle}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ☰
          </button>
        </div>
      </header>

      {/* MOBILE MENU */}
      <div className={`${styles.mobileMenu} ${menuOpen ? styles.open : ""}`}>
        {navLink("/", "Trang chủ")}
        {navLink("/search", "Tra cứu")}
        {navProtected("/manage", "Quản lý tác phẩm", "manage")}
        {navProtected("/register-work", "Đăng ký", "register")}
        {navProtected("/trade", "Giao dịch tác phẩm", "trade")}
      </div>
    </>
  );
}

function LockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
