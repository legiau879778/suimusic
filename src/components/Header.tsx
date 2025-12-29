"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "@/styles/Header.module.css";

import { useAuth } from "@/context/AuthContext";
import { useModal } from "@/context/ModalContext";
import { saveRedirect } from "@/lib/redirect";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

/** ✅ membership helpers */
import {
  type Membership,
  getMembershipEntitlements,
  getMembershipBadgeLabel,
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
  const lastScrollRef = useRef(0);

  // Membership data realtime
  const [dbMembership, setDbMembership] = useState<Membership | null>(null);
  const [countdown, setCountdown] = useState("");

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mobileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  // 1. Listen to Firebase Realtime to update Header Badge immediately after purchase
  useEffect(() => {
    if (!mounted || !user?.id) {
      setDbMembership(null);
      return;
    }
    const unsub = onSnapshot(doc(db, "users", user.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.membership) {
          setDbMembership(data.membership as Membership);
        } else {
          setDbMembership(null);
        }
      }
    });
    return () => unsub();
  }, [mounted, user?.id]);

  // Prioritize from Firebase realtime, fallback from context
  const membership = useMemo(() => dbMembership || (user?.membership as Membership) || null, [dbMembership, user?.membership]);

  // 2. Countdown logic (if needed to display tooltip or hide badge when expired)
  useEffect(() => {
    if (!mounted || !membership?.expireAt) {
      setCountdown("");
      return;
    }

    const tick = () => {
      const diff = membership.expireAt - Date.now();
      if (diff <= 0) {
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

  // Logic Scroll & Click Outside
  useEffect(() => {
    if (!mounted) return;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      const last = lastScrollRef.current;
      if (y > last && y > 80) setHidden(true);
      else setHidden(false);
      lastScrollRef.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (userMenuOpen && wrapRef.current && !wrapRef.current.contains(t)) setUserMenuOpen(false);
      if (menuOpen && mobileRef.current && !mobileRef.current.contains(t)) {
        if ((e.target as HTMLElement)?.closest?.(`.${styles.menuToggle}`)) return;
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

  // Menu entitlements
  const ent = useMemo(() => {
    if (user?.role === "admin") return { canManage: true, canRegister: true, canTrade: true };
    return getMembershipEntitlements(membership);
  }, [membership, user?.role]);

  const navLink = (href: string, label: string) => (
    <Link href={href} className={`${styles.link} ${pathname === href ? styles.active : ""}`} onClick={() => { setUserMenuOpen(false); setMenuOpen(false); }}>
      {label}
    </Link>
  );

  const navProtected = (href: string, label: string, allowed: boolean) => (
    <div className={styles.navItemWrap}>
      <button type="button" className={`${styles.link} ${styles.linkBtn} ${pathname === href ? styles.active : ""}`} onClick={() => {
        if (!user) { saveRedirect(); openLogin(); return; }
        if (!allowed) { saveRedirect(); openPermission(); return; }
        setMenuOpen(false); setUserMenuOpen(false); router.push(href);
      }}>
        {label}
      </button>
      {!allowed && (
        <div className={styles.lockWrap} onClick={(e) => { e.stopPropagation(); saveRedirect(); !user ? openLogin() : openPermission(); }} title="Requires Membership">
          <LockIcon />
          <div className={styles.tooltip}>Requires appropriate Membership</div>
        </div>
      )}
    </div>
  );

  if (!mounted) return null;

  return (
    <>
      <header className={`${styles.header} ${hidden ? styles.hidden : ""} ${scrolled ? styles.scrolled : ""}`}>
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
              <button className={styles.loginBtn} onClick={() => { saveRedirect(); openLogin(); }}>Login</button>
            ) : (
              <div className={styles.avatarWrap} ref={wrapRef}>
                <button
                  className={`${styles.avatar} ${styles[user.role]} ${animateAvatar ? styles.avatarPop : ""}`}
                  onClick={() => setUserMenuOpen((v) => !v)}
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt="avatar" className={styles.avatarImg} />
                  ) : (
                    user.email?.[0]?.toUpperCase?.() ?? "U"
                  )}
                </button>

                {/* ✅ DISPLAY MEMBERSHIP BADGE FROM FIREBASE HERE */}
                {membership && (
                  <span 
                    className={`${styles.membershipBadge} ${styles[membership.type]}`}
                    title={`${getMembershipBadgeLabel(membership)} (Remaining: ${countdown})`}
                  >
                    {getMembershipBadgeLabel(membership)}
                  </span>
                )}

                <div className={styles.avatarTooltip}>{user.email}</div>

                {userMenuOpen && (
                  <div className={`${styles.dropdown} ${styles.open}`}>
                    <Link href="/profile" onClick={() => setUserMenuOpen(false)} className={styles.dropLink}>Profile</Link>
                    <button className={styles.dropBtn} onClick={() => { setUserMenuOpen(false); logout(); }}>Logout</button>
                  </div>
                )}
              </div>
            )}

            <button className={styles.menuToggle} onClick={() => setMenuOpen((v) => !v)}>☰</button>
          </div>
        </div>
      </header>

      <div className={`${styles.mobileMenu} ${menuOpen ? styles.open : ""}`} ref={mobileRef}>
        {navLink("/", "Home")}
        {navLink("/search", "Search")}
        {navLink("/leaderboard/authors", "Leaderboard")}
        {navProtected("/manage", "Manage", !!ent.canManage)}
        {navProtected("/register-work", "Register", !!ent.canRegister)}
        {navProtected("/marketplace", "Marketplace", !!ent.canTrade)}
      </div>
    </>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
