"use client";

import { useMemo, useState } from "react";
import StatCard from "@/components/admin/StatCard";
import ApprovalLineChart from "@/components/admin/ApprovalLineChart";
import DrillModal from "@/components/admin/DrillModal";
import { getAdminStats } from "@/lib/adminStats";
import styles from "@/styles/admin/dashboard.module.css";

export default function AdminPage() {
  const stats = useMemo(() => getAdminStats(), []);
  const [drill, setDrill] = useState<null | {
    title: string;
    items: string[];
  }>(null);

  return (
    <main className={styles.dashboard}>
      <h1 className={styles.title}>Dashboard</h1>

      <div className={styles.grid}>
        <StatCard
          label="Tác phẩm đã duyệt"
          value={stats.verified}
          variant="verified"
          onClick={() =>
            setDrill({
              title: "Tác phẩm đã duyệt",
              items: stats.verifiedList,
            })
          }
        />

        <StatCard
          label="Chờ duyệt"
          value={stats.pending}
          variant="pending"
        />

        <StatCard
          label="Bị từ chối"
          value={stats.rejected}
          variant="rejected"
        />

        <StatCard
          label="Admin"
          value={stats.admins}
          variant="admin"
        />

        <StatCard
          label="Người dùng"
          value={stats.users}
          variant="user"
        />
      </div>

      <ApprovalLineChart data={stats.approvalByDay} />

      {drill && (
        <DrillModal
          title={drill.title}
          items={drill.items}
          onClose={() => setDrill(null)}
        />
      )}
    </main>
  );
}
