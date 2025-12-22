"use client";

import { useState } from "react";
import styles from "@/styles/profile.module.css";
import ProfileSidebar from "./tabs/ProfileSidebar";
import InfoTab from "./tabs/InfoTab";
import MembershipTab from "./tabs/MembershipTab";
import HistoryTab from "./tabs/HistoryTab";
import SettingsTab from "./tabs/SettingsTab";

export default function ProfileLayout() {
  const [tab, setTab] = useState<
    "info" | "membership" | "history" | "settings"
  >("info");

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <ProfileSidebar active={tab} onChange={setTab} />

        <div className={styles.content}>
          {tab === "info" && <InfoTab />}
          {tab === "membership" && <MembershipTab />}
          {tab === "history" && <HistoryTab />}
          {tab === "settings" && <SettingsTab />}
        </div>
      </div>
    </div>
  );
}
