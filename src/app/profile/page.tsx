"use client";

import { useState } from "react";
import styles from "@/styles/profile.module.css";
import { useAuth } from "@/context/AuthContext";

import MembershipPanel from "@/components/profile/tabs/MembershipTab";
import ProfileInfoPanel from "@/components/profile/tabs/InfoTab";
import TradeHistoryPanel from "@/components/profile/tabs/HistoryTab";
import SettingsPanel from "@/components/profile/tabs/SettingsTab";
import WalletPanel from "@/components/profile/WalletPanel";

type Tab = "membership" | "info" | "history" | "settings";

export default function ProfilePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("membership");

  if (!user) return null;

  return (
    <main className={styles.profilePage}>
      <div
        className={`${styles.profileLayout} ${
          tab !== "info" ? styles.noWallet : ""
        }`}
      >
        {/* SIDEBAR */}
        <aside className={styles.sidebar}>
          <div className={styles.avatarBox}>
            <div className={styles.avatar}>
              {user.avatar ? (
                <img src={user.avatar} className={styles.avatarImg} />
              ) : (
                user.email[0].toUpperCase()
              )}
            </div>

            <span className={styles.userId}>{user.email}</span>

            {user.role !== "user" && (
              <span className={styles.roleBadge}>
                {user.role === "admin" ? "Admin" : "Author"}
              </span>
            )}
          </div>

          <nav className={styles.sideNav}>
            <button
              className={tab === "membership" ? styles.active : ""}
              onClick={() => setTab("membership")}
            >
              Membership
            </button>
            <button
              className={tab === "info" ? styles.active : ""}
              onClick={() => setTab("info")}
            >
              Thông tin cá nhân
            </button>
            <button
              className={tab === "history" ? styles.active : ""}
              onClick={() => setTab("history")}
            >
              Lịch sử giao dịch
            </button>
            <button
              className={tab === "settings" ? styles.active : ""}
              onClick={() => setTab("settings")}
            >
              Cài đặt
            </button>
          </nav>
        </aside>

        {/* MAIN CONTENT */}
        <section className={styles.contentArea}>
          <div className={styles.animatedPanel} key={tab}>
            {tab === "membership" && <MembershipPanel />}
            {tab === "info" && <ProfileInfoPanel />}
            {tab === "history" && <TradeHistoryPanel />}
            {tab === "settings" && <SettingsPanel />}
          </div>
        </section>

        {/* WALLET – CHỈ INFO */}
        {tab === "info" && (
          <aside className={styles.walletArea}>
            <WalletPanel />
          </aside>
        )}
      </div>
    </main>
  );
}
