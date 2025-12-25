"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "@/styles/admin/dashboard.module.css";

import { getWorks } from "@/lib/workStore";
import { buildAdminStats } from "@/lib/adminStats";

import { ShieldCheck, XCircle, CalendarCheck } from "@phosphor-icons/react";

/* ================= TYPES ================= */

type ApprovalDay = {
  date: string;
  verified: number;
  rejected: number;
};

type AdminStats = {
  approvalByDay: ApprovalDay[];
};

/* ================= COMPONENT ================= */

export default function DashboardStats() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  // chống refresh chồng khi event bắn liên tục
  const refreshingRef = useRef(false);

  const refreshStats = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const works = getWorks() || [];
      const s = buildAdminStats(works) as AdminStats;
      setStats(s);
    } finally {
      refreshingRef.current = false;
    }
  };

  /* ================= INIT + REALTIME ================= */
  useEffect(() => {
    void refreshStats();

    // ✅ SAME TAB: ManagePage/ReviewPage bắn event này sau khi duyệt
    const onWorksUpdated = () => void refreshStats();

    // ✅ CROSS TAB: nếu duyệt ở tab khác -> localStorage thay đổi -> tab này cập nhật
    const onStorage = () => void refreshStats();

    // ✅ khi user quay lại tab (đỡ trường hợp bỏ tab lâu)
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshStats();
    };

    window.addEventListener("works_updated", onWorksUpdated);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVis);

    // ✅ fallback poll nhẹ (nếu bạn quên bắn event ở chỗ duyệt)
    const id = window.setInterval(() => void refreshStats(), 15000);

    return () => {
      window.removeEventListener("works_updated", onWorksUpdated);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    if (!stats) {
      return { verifiedTotal: 0, rejectedTotal: 0, activeDays: 0 };
    }

    const verifiedTotal = stats.approvalByDay.reduce((sum, d) => sum + d.verified, 0);
    const rejectedTotal = stats.approvalByDay.reduce((sum, d) => sum + d.rejected, 0);

    return {
      verifiedTotal,
      rejectedTotal,
      activeDays: stats.approvalByDay.length,
    };
  }, [stats]);

  if (!stats) {
    return (
      <div className={styles.grid}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      <StatCard
        title="Tác phẩm đã duyệt"
        value={summary.verifiedTotal}
        subtitle="Tổng số tác phẩm được phê duyệt"
        icon={<ShieldCheck weight="duotone" size={22} />}
        tone="success"
      />

      <StatCard
        title="Tác phẩm bị từ chối"
        value={summary.rejectedTotal}
        subtitle="Không đạt yêu cầu kiểm duyệt"
        icon={<XCircle weight="duotone" size={22} />}
        tone="danger"
      />

      <StatCard
        title="Ngày hoạt động"
        value={summary.activeDays}
        subtitle="Số ngày có kiểm duyệt"
        icon={<CalendarCheck weight="duotone" size={22} />}
        tone="neutral"
      />
    </div>
  );
}

/* ================= UI COMPONENTS ================= */

function StatCard({
  title,
  value,
  subtitle,
  icon,
  tone = "neutral",
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  tone?: "success" | "danger" | "neutral";
}) {
  return (
    <div
      className={`${styles.card} ${
        tone === "success" ? styles.cardSuccess : tone === "danger" ? styles.cardDanger : ""
      }`}
    >
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>{title}</span>
        <span className={styles.cardIcon}>{icon}</span>
      </div>

      <div className={styles.cardValue}>{value}</div>

      <div className={styles.cardSubtitle}>{subtitle}</div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className={`${styles.card} ${styles.skeleton}`}>
      <div className={styles.skeletonLine} />
      <div className={styles.skeletonValue} />
      <div className={styles.skeletonLineSmall} />
    </div>
  );
}
