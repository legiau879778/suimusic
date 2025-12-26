"use client";

import styles from "@/styles/admin/stats.module.css";
import ApprovalChart from "@/components/admin/charts/ApprovalChart";

export default function StatsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Review stats</h1>
        <p className={styles.sub}>
          Chart updates in realtime when admins approve/reject (works_updated + storage)
        </p>
      </header>

      <ApprovalChart />
    </main>
  );
}
