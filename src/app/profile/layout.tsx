"use client";

import ProfileSidebar from "@/components/ProfileSidebar";
import styles from "@/styles/profileLayout.module.css";

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.wrapper}>
      <ProfileSidebar />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
