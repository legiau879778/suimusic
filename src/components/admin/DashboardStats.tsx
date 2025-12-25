"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/styles/admin/dashboard.module.css";

import { getWorks } from "@/lib/workStore";
import { buildAdminStats } from "@/lib/adminStats";

import {
  CheckCircle,
  XCircle,
  Clock,
  Files,
} from "@phosphor-icons/react";

type Stat = ReturnType<typeof buildAdminStats>;

export default function DashboardStats() {
  const [stats, setStats] = useState<Stat>(() => buildAdminStats(getWorks()));

  useEffect(() => {
    const refresh = () => {
      try {
        setStats(buildAdminStats(getWorks()));
      } catch {
        setStats(buildAdminStats([]));
      }
    };

    refresh();

    // ✅ same-tab realtime (workStore.save dispatch "works_updated")
    window.addEventListener("works_updated", refresh);

    // ✅ cross-tab realtime
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.includes("chainstorm_works")) refresh();
    };
    window.addEventListener("storage", onStorage);

    // ✅ when back to tab
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("works_updated", refresh);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const totals = useMemo(() => {
    return {
      verified: stats.verified,
      rejected: stats.rejected,
      pending: stats.pending,
      total: stats.total,
      activeDays: (stats.approvalByDay || []).length,
    };
  }, [stats]);

  return (
    <div className={styles.grid}>
      <StatCard
        title="Tổng tác phẩm"
        value={totals.total}
        icon={<Files size={18} weight="duotone" />}
        tone="muted"
      />
      <StatCard
        title="Đã duyệt"
        value={totals.verified}
        icon={<CheckCircle size={18} weight="fill" />}
        tone="ok"
      />
      <StatCard
        title="Bị từ chối"
        value={totals.rejected}
        icon={<XCircle size={18} weight="fill" />}
        tone="bad"
      />
      <StatCard
        title="Đang chờ"
        value={totals.pending}
        icon={<Clock size={18} weight="duotone" />}
        tone="info"
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone = "muted",
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  tone?: "ok" | "bad" | "info" | "muted";
}) {
  return (
    <div
      className={`${styles.card} ${
        tone === "ok"
          ? styles.cardOk
          : tone === "bad"
          ? styles.cardBad
          : tone === "info"
          ? styles.cardInfo
          : ""
      }`}
    >
      <div className={styles.cardTop}>
        <span className={styles.cardTitle}>{title}</span>
        <span className={styles.cardIcon} aria-hidden="true">
          {icon}
        </span>
      </div>
      <strong className={styles.cardValue}>{value}</strong>
    </div>
  );
}
