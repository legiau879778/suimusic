"use client";

import { getWorks } from "@/lib/workStore";
import { buildAdminStats } from "@/lib/adminStats";
import styles from "@/styles/admin/dashboard.module.css";
import { useEffect, useState } from "react";

export default function DashboardStats() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const works = getWorks() || [];
    setStats(buildAdminStats(works));
  }, []);

  if (!stats) return null;

  return (
    <div className={styles.grid}>
      <StatCard
        title="Approved works"
        value={stats.approvalByDay.reduce(
          (a: number, b: any) => a + b.verified,
          0
        )}
      />
      <StatCard
        title="Rejected works"
        value={stats.approvalByDay.reduce(
          (a: number, b: any) => a + b.rejected,
          0
        )}
      />
      <StatCard
        title="Active days"
        value={stats.approvalByDay.length}
      />
    </div>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className={styles.card}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}
