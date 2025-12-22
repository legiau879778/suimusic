"use client";

import styles from "@/styles/profile.module.css";

export default function ProfileTabContent({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={styles.tabSlider}
      style={{ transform: `translateX(-${TAB_INDEX[active] * 100}%)` }}
    >
      {children}
    </div>
  );
}

const TAB_INDEX: Record<string, number> = {
  info: 0,
  membership: 1,
  history: 2,
  settings: 3,
};
