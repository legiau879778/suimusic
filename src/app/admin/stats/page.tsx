"use client";

import styles from "@/styles/admin/stats.module.css";
import ApprovalChart from "@/components/admin/charts/ApprovalChart";

export default function StatsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Thống kê duyệt</h1>
        <p className={styles.sub}>
          Biểu đồ cập nhật realtime khi admin duyệt/từ chối (works_updated + storage)
        </p>
      </header>

      <ApprovalChart />
    </main>
  );
}
