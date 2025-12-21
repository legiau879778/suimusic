"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useLoginModal } from "@/context/LoginModalContext";
import {
  getActiveAdminWallet,
} from "@/lib/adminWalletStore";
import { connectWallet } from "@/lib/wallet";
import { getCurrentUser } from "@/lib/authStore";
import styles from "@/styles/header.module.css";

export default function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { openLogin } = useLoginModal();

  const user = getCurrentUser();
  const activeWallet =
    user?.email ? getActiveAdminWallet(user.email) : null;

  const [hidden, setHidden] = useState(false);
  const [lastY, setLastY] = useState(0);

  /* AUTO HIDE */
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
      {/* LOGO */}
      <Link href="/" className={styles.logo}>
        <span>⚡</span>
        <strong>CHAINSTORM</strong>
      </Link>

      {/* NAV */}
      <nav className={styles.nav}>
        <Link href="/" className={isActive("/") ? styles.active : ""}>
          Trang chủ
        </Link>
        <Link href="/search" className={isActive("/search") ? styles.active : ""}>
          Tra cứu
        </Link>
        <Link href="/manage" className={isActive("/manage") ? styles.active : ""}>
          Quản lý
        </Link>
        <Link href="/trade" className={isActive("/trade") ? styles.active : ""}>
          Giao dịch
        </Link>
      </nav>

      {/* AUTH */}
      <div className={styles.auth}>
        {/* NOT LOGIN */}
        {!session && (
          <button onClick={openLogin} className={styles.login}>
            Đăng nhập
          </button>
        )}

        {/* LOGGED IN */}
        {session && user && (
          <div className={styles.userBox}>
            <img
              src={session.user?.image || ""}
              className={styles.avatar}
              alt="avatar"
            />

            <div className={styles.userMenu}>
              <strong>{session.user?.name}</strong>
              <span className={styles.email}>{user.email}</span>

              {/* WALLET */}
              {user.role === "admin" && (
                <div className={styles.wallet}>
                  {activeWallet ? (
                    <span className={styles.walletConnected}>
                      🔗 {activeWallet.address.slice(0, 6)}…
                      {activeWallet.address.slice(-4)}
                    </span>
                  ) : (
                    <button
                      className={styles.walletBtn}
                      onClick={async () => {
                        const addr = await connectWallet();
                        const { connectAdminWallet } =
                          await import("@/lib/adminWalletStore");
                        connectAdminWallet(user.email, addr);
                        location.reload();
                      }}
                    >
                      🔗 Kết nối Wallet
                    </button>
                  )}
                </div>
              )}

              {/* ADMIN */}
              {user.role === "admin" && (
                <Link href="/admin">Admin Panel</Link>
              )}

              <button
                className={styles.logout}
                onClick={() => signOut()}
              >
                Đăng xuất
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
