"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
HEAD
import { useEffect, useState } from "react";
import styles from '@/styles/header.module.css'
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "@/styles/header.module.css";
e1d6e1383e50df77f91295a5cf7e4b97a8024fa7
import { useAuth } from "@/context/AuthContext";
import { useModal } from "@/context/ModalContext";
import { saveRedirect } from "@/lib/redirect";

/** ✅ membership entitlements */
import {
  Membership,
  getActiveMembership,
  getMembershipEntitlements,
  getMembershipBadgeLabel,
} from "@/lib/membershipStore";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { openLogin, openPermission } = useModal();

  /* ================= HOOKS (PHẢI LUÔN CHẠY) ================= */

  const [mounted, setMounted] = useState(false);

  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [animateAvatar, setAnimateAvatar] = useState(false);
  const [lastScroll, setLastScroll] = useState(0);

  const [membership, setMembership] = useState<Membership | null>(null);
  const [countdown, setCountdown] = useState("");

  const userId = user?.id || user?.email || "";

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mobileRef = useRef<HTMLDivElement | null>(null);

  /* ================= EFFECTS ================= */

  // mount flag (HYDRATION SAFE)
  useEffect(() => {
    setMounted(true);
  }, []);

  // ✅ load membership theo USER (đổi Gmail là đổi quyền ngay)
  useEffect(() => {
    if (!mounted) return;

    if (!userId) {
      setMembership(null);
      setCountdown("");
      return;
    }

    getActiveMembership(userId)
      .then((m) => setMembership(m))
      .catch(() => setMembership(null));
  }, [mounted, userId]);

  // header auto hide
  useEffect(() => {
    if (!mounted) return;

    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastScroll && y > 80) setHidden(true);
      else setHidden(false);
      setLastScroll(y);
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [lastScroll, mounted]);

  // avatar animation
  useEffect(() => {
    if (!mounted || !user) return;

    setAnimateAvatar(true);
    const t = setTimeout(() => setAnimateAvatar(false), 900);
    return () => clearTimeout(t);
  }, [user?.id, mounted]);

  // membership countdown
  useEffect(() => {
    if (!mounted || !membership) return;

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
  }, [membership, mounted]);

  // ✅ click outside để đóng dropdown + mobile menu
  useEffect(() => {
    if (!mounted) return;

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;

      // đóng user dropdown nếu click ngoài vùng avatarWrap
      if (userMenuOpen && wrapRef.current && !wrapRef.current.contains(t)) {
        setUserMenuOpen(false);
      }

      // đóng mobile menu nếu click ngoài menu (và không click vào nút ☰)
      if (menuOpen && mobileRef.current && !mobileRef.current.contains(t)) {
        // nếu click vào chính nút toggle thì bỏ qua (nút nằm trong header)
        const el = e.target as HTMLElement;
        if (el?.closest?.(`.${styles.menuToggle}`)) return;
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [mounted, userMenuOpen, menuOpen]);

  // ✅ đóng mobile menu khi đổi route
  useEffect(() => {
    if (!mounted) return;
    setMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname, mounted]);

  /* ================= ENTITLEMENTS ================= */

  const ent = useMemo(() => {
    // admin: mở tất cả
    if (user?.role === "admin") {
      return { canManage: true, canRegister: true, canTrade: true };
    }
    return getMembershipEntitlements(membership);
  }, [membership, user?.role]);

  /* ================= HELPERS ================= */

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`${styles.link} ${pathname === href ? styles.active : ""}`}
      onClick={() => {
        // đóng dropdown/menu cho gọn UX
        setUserMenuOpen(false);
        setMenuOpen(false);
      }}
    >
      {label}
    </Link>
  );

  // ✅ BIND MENU: allowed lấy từ entitlements
  const navProtected = (
    href: string,
    label: string,
    allowed: boolean
  ) => (
    <div className={styles.navItemWrap}>
      <button
        className={styles.link}
        onClick={() => {
          // chưa login -> login
          if (!user) {
            saveRedirect();
            openLogin();
            return;
          }

          // có login nhưng chưa đủ quyền -> permission
          if (!allowed) {
            saveRedirect();
            openPermission();
            return;
          }

          setMenuOpen(false);
          setUserMenuOpen(false);
          router.push(href);
        }}
      >
        {label}
      </button>

      {!allowed && (
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

  /* ================= RENDER ================= */

  // 👉 chỉ chặn render UI, KHÔNG chặn hooks
  if (!mounted) return null;

  return (
    <>
      <header className={`${styles.header} ${hidden ? styles.hidden : ""}`}>
        <Link href="/" className={styles.logo} onClick={() => setMenuOpen(false)}>
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

          {/* ✅ bind theo entitlements */}
          {navProtected("/manage", "Quản lý tác phẩm", !!ent.canManage)}
          {navProtected("/register-work", "Đăng ký tác phẩm", !!ent.canRegister)}
          {navProtected("/marketplace", "Giao dịch tác phẩm", !!ent.canTrade)}

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
            <div className={styles.avatarWrap} ref={wrapRef}>
              <button
                className={`${styles.avatar} ${styles[user.role]} ${
                  animateAvatar ? styles.avatarPop : ""
                }`}
                onClick={() => setUserMenuOpen((v) => !v)}
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

              {membership && (
                <span
                  className={`${styles.membershipBadge} ${
                    styles[membership.type]
                  }`}
                  title={getMembershipBadgeLabel(membership)}
                >
                  {getMembershipBadgeLabel(membership)}
                </span>
              )}

              {membership && countdown && (
                <div className={styles.membershipCountdown}>Hết hạn sau {countdown}</div>
              )}

              <div className={styles.avatarTooltip}>{user.email}</div>

              {userMenuOpen && (
                <div className={`${styles.dropdown} ${styles.open}`}>
                  <Link href="/profile">Hồ sơ</Link>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                  >
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            className={styles.menuToggle}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="menu"
          >
            ☰
          </button>
        </div>
      </header>

      <div
        className={`${styles.mobileMenu} ${menuOpen ? styles.open : ""}`}
        ref={mobileRef}
      >
        {navLink("/", "Trang chủ")}
        {navLink("/search", "Tra cứu")}

        {/* ✅ bind theo entitlements */}
        {navProtected("/manage", "Quản lý tác phẩm", !!ent.canManage)}
        {navProtected("/register-work", "Đăng ký", !!ent.canRegister)}
        {navProtected("/marketplace", "Giao dịch tác phẩm", !!ent.canTrade)}
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
