"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/styles/profile.module.css";
import { useAuth } from "@/context/AuthContext";

import MembershipTab from "@/components/profile/tabs/MembershipTab";
import ProfileInfoPanel from "@/components/profile/tabs/InfoTab";
import TradeHistoryPanel from "@/components/profile/tabs/HistoryTab";
import SettingsPanel from "@/components/profile/tabs/SettingsTab";

import {
  type Membership,
  getCachedMembership,
  getActiveMembership,
  subscribeMembership,
} from "@/lib/membershipStore";

type Tab = "membership" | "info" | "history" | "settings";

function formatLeft(ms: number) {
  if (ms <= 0) return "Hết hạn";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${d} ngày ${h}h ${m}m ${s}s`;
}

export default function ProfilePage() {
  // ✅ hooks luôn được gọi (KHÔNG return sớm trước hooks)
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>("membership");
  const [membership, setMembership] = useState<Membership | null>(null);
  const [timeLeft, setTimeLeft] = useState("");

  // fallback an toàn khi user chưa có
  const userId = user?.id ?? "";
  const email = user?.email ?? "";
  const role = user?.role ?? "user";
  const membershipType = user?.membership ?? null;

  // ======================
  // LOAD MEMBERSHIP (cached -> verify)
  // ======================
  const loadMembership = async () => {
    if (!userId) {
      setMembership(null);
      setTimeLeft("");
      return;
    }

    const cached = getCachedMembership(userId, email);
    if (cached) setMembership(cached);
    else setMembership(null);

    try {
      const truth = await getActiveMembership({ userId, email });
      setMembership(truth);
    } catch {
      // keep cached
    }
  };

  useEffect(() => {
    // user chưa có thì không load
    if (!userId) return;
    void loadMembership();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, email]);

  useEffect(() => {
    if (!userId) return;

    const unsub = subscribeMembership(() => {
      void loadMembership();
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, email]);

  // ======================
  // REALTIME COUNTDOWN
  // ======================
  useEffect(() => {
    if (!membership?.expireAt) {
      setTimeLeft("");
      return;
    }

    const tick = () => {
      const diff = membership.expireAt - Date.now();
      setTimeLeft(formatLeft(diff));
      if (diff <= 0) {
        setMembership(null);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [membership?.expireAt]);

  // ======================
  // MENU ACCESS (đúng theo membershipType/role đã sync)
  // ✅ useMemo luôn chạy dù user null -> không đổi thứ tự hooks
  // ======================
  const canAccess = useMemo(() => {
    return (key: Tab) => {
      if (key === "membership") return true;
      if (key === "info") return true;
      if (key === "settings") return true;

      // ví dụ: history chỉ business
      if (key === "history") return membershipType === "business";

      return true;
    };
  }, [membershipType]);

  // ✅ giờ mới được return sớm (sau khi gọi hết hooks)
  if (!user) return null;

  return (
    <main className={styles.profilePage}>
      <div className={styles.profileLayout}>
        {/* ================= SIDEBAR ================= */}
        <aside className={styles.sidebar}>
          <div className={styles.avatarBox}>
            <div className={styles.avatar}>
              {user.avatar ? (
                <img
                  className={styles.avatarImg}
                  src={user.avatar}
                  alt="avatar"
                />
              ) : (
                user.email?.[0]?.toUpperCase()
              )}
            </div>

            <div>
              <strong>{user.email}</strong>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                Role: <b>{role}</b>
                {membershipType ? (
                  <>
                    {" "}
                    · Membership: <b>{membershipType}</b>
                  </>
                ) : null}
              </div>
            </div>

            {membership && (
              <div className={styles.currentMembership}>
                <div>
                  <strong>{membership.type.toUpperCase()}</strong>
                  {"plan" in membership && (membership as any).plan
                    ? ` (${String((membership as any).plan).toUpperCase()})`
                    : ""}
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
