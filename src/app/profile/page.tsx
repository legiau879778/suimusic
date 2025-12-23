"use client";

import { useEffect, useState } from "react";
import styles from "@/styles/profile.module.css";
import { useAuth } from "@/context/AuthContext";

import MembershipTab from "@/components/profile/tabs/MembershipTab";
import ProfileInfoPanel from "@/components/profile/tabs/InfoTab";
import TradeHistoryPanel from "@/components/profile/tabs/HistoryTab";
import SettingsPanel from "@/components/profile/tabs/SettingsTab";
import WalletPanel from "@/components/profile/WalletPanel";

type Tab = "membership" | "info" | "history" | "settings";

type Membership = {
  type: "artist" | "creator" | "business";
  plan?: "starter" | "pro" | "studio";
  expireAt: number;
  txHash: string;
  block: number;
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("membership");
  const [membership, setMembership] = useState<Membership | null>(null);
  const [timeLeft, setTimeLeft] = useState("");

  /* ======================
     LOAD MEMBERSHIP
  ====================== */
  useEffect(() => {
    const raw = localStorage.getItem("membership");
    if (raw) setMembership(JSON.parse(raw));
  }, []);

  /* ======================
     REALTIME COUNTDOWN
  ====================== */
  useEffect(() => {
    if (!membership) return;

    const tick = () => {
      const diff = membership.expireAt - Date.now();
      if (diff <= 0) {
        setTimeLeft("Hết hạn");
        return;
      }

      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      setTimeLeft(`${d} ngày ${h}h ${m}m ${s}s`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [membership]);

  if (!user) return null;

  /* ======================
     MENU ACCESS (REAL)
  ====================== */
  const canAccess = (key: Tab) => {
    if (!membership) return key === "membership";
    if (key === "history") return membership.type === "business";
    if (key === "settings") return true;
    if (key === "info") return true;
    return true;
  };

  return (
    <main className={styles.profilePage}>
      <div className={styles.profileLayout}>
        {/* ================= SIDEBAR ================= */}
        <aside className={styles.sidebar}>
          <div className={styles.avatarBox}>
            <div className={styles.avatar}>
              {user.avatar
                ? <img src={user.avatar} />
                : user.email[0].toUpperCase()}
            </div>

            <div>
              <strong>{user.email}</strong>
            </div>

            {membership && (
              <div className={styles.currentMembership}>
                <div>
                  {membership.type.toUpperCase()}
                  {membership.plan && ` (${membership.plan.toUpperCase()})`}
                </div>
                <small>Còn lại: {timeLeft}</small>
              </div>
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
              disabled={!canAccess("info")}
              className={tab === "info" ? styles.active : ""}
              onClick={() => setTab("info")}
            >
              Thông tin cá nhân
            </button>

            <button
              disabled={!canAccess("history")}
              className={tab === "history" ? styles.active : ""}
              onClick={() => setTab("history")}
            >
              Lịch sử giao dịch
            </button>

            <button
              disabled={!canAccess("settings")}
              className={tab === "settings" ? styles.active : ""}
              onClick={() => setTab("settings")}
            >
              Cài đặt
            </button>
          </nav>
        </aside>

        {/* ================= MAIN ================= */}
        <section className={styles.contentArea}>
          {tab === "membership" && <MembershipTab />}
          {tab === "info" && <ProfileInfoPanel />}
          {tab === "history" && <TradeHistoryPanel />}
          {tab === "settings" && <SettingsPanel />}
        </section>
      </div>
    </main>
  );
}
