"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/styles/profile.module.css";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

import MembershipTab from "@/components/profile/tabs/MembershipTab";
import ProfileInfoPanel from "@/components/profile/tabs/InfoTab";
import TradeHistoryPanel from "@/components/profile/tabs/HistoryTab";
import SettingsPanel from "@/components/profile/tabs/SettingsTab";

import { type Membership, getMembershipBadgeLabel } from "@/lib/membershipStore";

type Tab = "membership" | "info" | "history" | "settings";

function formatLeft(ms: number) {
  if (ms <= 0) return "Expired";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${d} days ${h}h ${m}m ${s}s`;
}

export default function ProfilePage() {
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>("membership");
  const [timeLeft, setTimeLeft] = useState("");
  const [dbMembership, setDbMembership] = useState<Membership | null>(null);

  // 1. Listen to Realtime from Firebase to update Role/Membership immediately
  useEffect(() => {
    if (!user?.id) return;
    const unsub = onSnapshot(doc(db, "users", user.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDbMembership((data.membership as Membership) || null);
      }
    });
    return () => unsub();
  }, [user?.id]);

  // Prioritize Realtime data
  const membership = useMemo(() => {
    return dbMembership || (user?.membership as Membership) || null;
  }, [dbMembership, user?.membership]);

  // Display Role based on membership type
  const displayRole = useMemo(() => {
    if (user?.role === "admin") return "ADMIN";
    if (membership?.type) return membership.type.toUpperCase();
    return "MEMBER"; // Default if no package
  }, [user?.role, membership?.type]);

  const membershipType = membership?.type ?? null;

  // Realtime Countdown
  useEffect(() => {
    if (!membership?.expireAt) {
      setTimeLeft("");
      return;
    }
    const tick = () => {
      const diff = membership.expireAt - Date.now();
      setTimeLeft(formatLeft(diff));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [membership?.expireAt]);

  const canAccess = useMemo(() => {
    return (key: Tab) => {
      if (key === "membership" || key === "info" || key === "settings") return true;
      if (key === "history") return !!membershipType;
      return true;
    };
  }, [membershipType]);

  if (!user) return null;

  return (
    <main className={styles.profilePage}>
      <div className={styles.profileLayout}>
        {/* ================= SIDEBAR ================= */}
        <aside className={styles.sidebar}>
          <div className={styles.avatarBox}>
            <div className={styles.avatar}>
              {user.avatar ? (
                <img className={styles.avatarImg} src={user.avatar} alt="avatar" />
              ) : (
                user.email?.[0]?.toUpperCase()
              )}
            </div>

            <div>
              <strong className={styles.userEmailText}>{user.email}</strong>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                Role: <b style={{ color: membership ? "#f59e0b" : "inherit" }}>{displayRole}</b>
                {/* {membershipType && (
                  <>
                    {" "} · Membership: <b>{getMembershipBadgeLabel(membership)}</b>
                  </>
                )} */}
              </div>
            </div>

            {membership && (
              <div className={`${styles.currentMembership} ${styles[membership.type]}`}>
                <div>
                  <strong>{membership.type.toUpperCase()}</strong>
                  {membership.plan ? ` (${String(membership.plan).toUpperCase()})` : ""}
                </div>
                <small>Remaining: {timeLeft}</small>
              </div>
            )}
          </div>

          <nav className={styles.sideNav}>
            <button className={tab === "membership" ? styles.active : ""} onClick={() => setTab("membership")}>
              Membership
            </button>
            <button disabled={!canAccess("info")} className={tab === "info" ? styles.active : ""} onClick={() => setTab("info")}>
              Personal Information
            </button>
            <button disabled={!canAccess("history")} className={tab === "history" ? styles.active : ""} onClick={() => setTab("history")}>
              Transaction History
            </button>
            <button disabled={!canAccess("settings")} className={tab === "settings" ? styles.active : ""} onClick={() => setTab("settings")}>
              Settings
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