"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import styles from "@/styles/Header.module.css";

import { useAuth } from "@/context/AuthContext";
import { useModal } from "@/context/ModalContext";
import { saveRedirect } from "@/lib/redirect";

/** ✅ membership */
import {
  type Membership,
  getCachedMembership,
  getActiveMembership,
  getMembershipEntitlements,
  getMembershipBadgeLabel,
  subscribeMembership,
} from "@/lib/membershipStore";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { openLogin, openPermission } = useModal();

  const [mounted, setMounted] = useState(false);

  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [animateAvatar, setAnimateAvatar] = useState(false);

  const [lastScroll, setLastScroll] = useState(0);

  const [membership, setMembership] = useState<Membership | null>(null);
  const [countdown, setCountdown] = useState("");

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mobileRef = useRef<HTMLDivElement | null>(null);

  const userId = user?.id ?? "";
  const email = user?.email ?? "";

  useEffect(() => setMounted(true), []);

  const loadMembership = useCallback(async () => {
    if (!mounted || !userId) {
      setMembership(null);
      setCountdown("");
      return;
    }

    const cached = getCachedMembership(userId, email);
    if (cached) setMembership(cached);

    try {
      const truth = await getActiveMembership({ userId, email });
      setMembership(truth);
    } catch {
      // keep cached
    }
  }, [mounted, userId, email]);

  useEffect(() => {
    void loadMembership();
  }, [loadMembership]);

  useEffect(() => {
    if (!mounted) return;
    const unsub = subscribeMembership(() => void loadMembership());
    return () => unsub();
  }, [mounted, loadMembership]);

  useEffect(() => {
    if (!mounted || !membership) {
      setCountdown("");
      return;
    }

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
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [membership, mounted]);

  useEffect(() => {
    if (!mounted) return;

    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);

      if (y > lastScroll && y > 80) setHidden(true);
      else setHidden(false);

      setLastScroll(y);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [lastScroll, mounted]);

  useEffect(() => {
    if (!mounted || !user) return;
    setAnimateAvatar(true);
    const t = setTimeout(() => setAnimateAvatar(false), 700);
    return () => clearTimeout(t);
  }, [mounted, user?.id]);

  useEffect(() => {
    if (!mounted) return;

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;

      if (userMenuOpen && wrapRef.current && !wrapRef.current.contains(t)) {
        setUserMenuOpen(false);
      }

      if (menuOpen && mobileRef.current && !mobileRef.current.contains(t)) {
        const el = e.target as HTMLElement;
        if (el?.closest?.(`.${styles.menuToggle}`)) return;
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [mounted, userMenuOpen, menuOpen]);

  useEffect(() => {
    if (!mounted) return;
    setMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname, mounted]);

  const ent = useMemo(() => {
    if (user?.role === "admin") {
      return { canManage: true, canRegister: true, canTrade: true };
    }
    return getMembershipEntitlements(membership);
  }, [membership, user?.role]);

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`${styles.link} ${pathname === href ? styles.active : ""}`}
      onClick={() => {
        setUserMenuOpen(false);
        setMenuOpen(false);
      }}
    >
      {label}
    </Link>
  );

  const navProtected = (href: string, label: string, allowed: boolean) => {
    const isActive = pathname === href;
    return (
      <div className={styles.navItemWrap}>
        <button
          className={`${styles.link} ${styles.linkBtn} ${isActive ? styles.active : ""}`}
          onClick={() => {
            if (!user) {
              saveRedirect();
              openLogin();
              return;
            }
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
            title="Membership required"
          >
            <LockIcon />
            <div className={styles.tooltip}>Membership required</div>
          </div>
        )}
      </div>
    );
  };

  if (!mounted) return null;

  return (
    <>
      <header
        className={`${styles.header} ${hidden ? styles.hidden : ""} ${
          scrolled ? styles.scrolled : ""
        }`}
      >
        <div className={styles.inner}>
          <Link href="/" className={styles.logo} onClick={() => setMenuOpen(false)}>
            <Image src="/images/logo.png" alt="Suimusic" width={34} height={34} priority />
            <span className={styles.logoText}>SUIMUSIC</span>
          </Link>

          <nav className={styles.nav}>
            {navLink("/", "Home")}
            {navLink("/search", "Search")}
            {navLink("/leaderboard/authors", "Leaderboard")}
            {navProtected("/manage", "Manage", !!ent.canManage)}
            {navProtected("/register-work", "Register", !!ent.canRegister)}
            {navProtected("/marketplace", "Marketplace", !!ent.canTrade)}
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
                Sign in
              </button>
            ) : (
              <div className={styles.avatarWrap} ref={wrapRef}>
                <button
                  className={`${styles.avatar} ${styles[user.role]} ${
                    animateAvatar ? styles.avatarPop : ""
                  }`}
                  onClick={() => setUserMenuOpen((v) => !v)}
                  aria-label="User menu"
                >
                  {user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatar}
                      alt="avatar"
                      referrerPolicy="no-referrer"
                      className={styles.avatarImg}
                    />
                  ) : (
                    user.email?.[0]?.toUpperCase?.() ?? "U"
                  )}
                </button>

                {membership && (
                  <span
                    className={`${styles.membershipBadge} ${styles[membership.type]}`}
                    title={getMembershipBadgeLabel(membership)}
                  >
                    {getMembershipBadgeLabel(membership)}
                  </span>
                )}

                <div className={styles.avatarTooltip}>{user.email}</div>

                {userMenuOpen && (
                  <div className={`${styles.dropdown} ${styles.open}`}>
                    <Link
                      href="/profile"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setMenuOpen(false);
                      }}
                      className={styles.dropLink}
                    >
                      Profile
                    </Link>

                    <button
                      className={styles.dropBtn}
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                    >
                      Sign out
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
        </div>
      </header>

      {/* MOBILE */}
      <div className={`${styles.mobileMenu} ${menuOpen ? styles.open : ""}`} ref={mobileRef}>
        {navLink("/", "Home")}
        {navLink("/search", "Search")}
        {navLink("/leaderboard/authors", "Leaderboard")}
        {navProtected("/manage", "Manage", !!ent.canManage)}
        {navProtected("/register-work", "Register", !!ent.canRegister)}
        {navProtected("/marketplace", "Marketplace", !!ent.canTrade)}
        {user?.role === "admin" && navLink("/admin", "Admin")}
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
