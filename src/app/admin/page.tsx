"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "@/styles/admin/dashboard.module.css";

import { getWorks } from "@/lib/workStore";
import { buildAdminStats } from "@/lib/adminStats";

import { CheckCircle, XCircle, Clock, Files, Pulse } from "@phosphor-icons/react";

type Stat = ReturnType<typeof buildAdminStats>;

export default function DashboardStats() {
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<Stat>(() => buildAdminStats([])); // SSR-safe
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);

    const refresh = () => {
      try {
        setStats(buildAdminStats(getWorks()));
      } catch {
        setStats(buildAdminStats([]));
      } finally {
        setLastUpdated(Date.now());
      }
    };

    refresh();

    window.addEventListener("works_updated", refresh);

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.includes("chainstorm_works")) refresh();
    };
    window.addEventListener("storage", onStorage);

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

  const hasData = totals.total > 0;

  const last7 = useMemo(() => {
    const arr = Array.isArray(stats.approvalByDay) ? stats.approvalByDay : [];
    return arr.slice(-7);
  }, [stats.approvalByDay]);

  if (!mounted) {
    return (
      <section className={styles.block}>
        <HeaderLine loading />
        <div className={styles.grid}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className={styles.quickRow}>
          <QuickPill loading />
          <QuickPill loading />
          <QuickPill loading />
        </div>

        <div className={styles.sparkCard}>
          <div className={styles.sparkTop}>
            <div className={styles.sparkTitle}>7-day trend</div>
            <div className={styles.sparkLegend}>
              <span className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles.dotOk}`} />
                Verified
              </span>
              <span className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles.dotBad}`} />
                Rejected
              </span>
            </div>
          </div>

          <div className={styles.sparkWrap}>
            <div className={styles.sparkSkeleton} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.block}>
      <HeaderLine
        subtitle="Work review overview (realtime from local storage / on-chain sync)."
        lastUpdated={lastUpdated}
      />

      <div className={styles.grid}>
        <StatCard title="Total works" value={totals.total} icon={<Files size={18} weight="duotone" />} tone="muted" />
        <StatCard title="Verified" value={totals.verified} icon={<CheckCircle size={18} weight="fill" />} tone="ok" />
        <StatCard title="Rejected" value={totals.rejected} icon={<XCircle size={18} weight="fill" />} tone="bad" />
        <StatCard title="Pending" value={totals.pending} icon={<Clock size={18} weight="duotone" />} tone="info" />
      </div>

      <div className={styles.quickRow}>
        <QuickPill label="Active days" value={`${totals.activeDays}`} />
        <QuickPill label="Approval rate" value={hasData ? `${Math.round((totals.verified / totals.total) * 100)}%` : "—"} />
        <QuickPill label="Reject rate" value={hasData ? `${Math.round((totals.rejected / totals.total) * 100)}%` : "—"} />
      </div>

      {/* Mini 7-day sparkline */}
      <div className={styles.sparkCard}>
        <div className={styles.sparkTop}>
          <div>
            <div className={styles.sparkTitle}>7-day trend</div>
            <div className={styles.sparkSub}>
              {last7.length ? `From ${last7[0].date} to ${last7[last7.length - 1].date}` : "Not enough daily data"}
            </div>
          </div>

          <div className={styles.sparkLegend}>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotOk}`} />
              Verified
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotBad}`} />
              Rejected
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotInfo}`} />
              Pending
            </span>
          </div>
        </div>

        <div className={styles.sparkWrap}>
          <MiniSparkline
            days={last7}
            pendingTotal={totals.pending}
          />
        </div>
      </div>

      {!hasData && (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>No data yet</div>
          <div className={styles.emptySub}>When works are created/approved, the dashboard updates in realtime.</div>
        </div>
      )}
    </section>
  );
}

/* ================= Header ================= */

function HeaderLine({
  subtitle,
  lastUpdated,
  loading,
}: {
  subtitle?: string;
  lastUpdated?: number | null;
  loading?: boolean;
}) {
  return (
    <div className={styles.head}>
      <div className={styles.headLeft}>
        <div className={styles.headTitleRow}>
          <div className={styles.headIcon} aria-hidden="true">
            <Pulse size={18} weight="duotone" />
          </div>
          <h2 className={styles.headTitle}>Dashboard</h2>
          <span className={styles.livePill}>
            <span className={styles.liveDot} />
            Realtime
          </span>
        </div>

        <p className={styles.headSub}>{loading ? <span className={styles.skeletonText} /> : subtitle}</p>
      </div>

      <div className={styles.headRight}>
        <div className={styles.updatedBox}>
          <span>Last updated</span>
          <strong>{loading ? "—" : lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "—"}</strong>
        </div>
      </div>
    </div>
  );
}

/* ================= Cards ================= */

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
        tone === "ok" ? styles.cardOk : tone === "bad" ? styles.cardBad : tone === "info" ? styles.cardInfo : ""
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

function QuickPill({ label, value, loading }: { label?: string; value?: string; loading?: boolean }) {
  return (
    <div className={styles.pill}>
      <span className={styles.pillLabel}>{loading ? "…" : label}</span>
      <strong className={styles.pillValue}>{loading ? "—" : value}</strong>
    </div>
  );
}

/* ================= Mini Sparkline (SVG) ================= */

type DayPoint = { date: string; verified: number; rejected: number };

function MiniSparkline({
  days,
  pendingTotal,
}: {
  days: DayPoint[];
  pendingTotal: number; // only show a small badge, not a line
}) {
  const width = 860;
  const height = 140;
  const padX = 16;
  const padY = 18;

  const v = days.map((d) => Number(d.verified) || 0);
  const r = days.map((d) => Number(d.rejected) || 0);

  const max = Math.max(1, ...v, ...r); // avoid /0

  const xAt = (i: number) => {
    const n = Math.max(1, days.length - 1);
    return padX + (i * (width - padX * 2)) / n;
  };

  const yAt = (val: number) => {
    const t = val / max;
    return padY + (1 - t) * (height - padY * 2);
  };

  const pathFrom = (arr: number[]) => {
    if (!arr.length) return "";
    return arr
      .map((val, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(val).toFixed(2)}`)
      .join(" ");
  };

  const verifiedPath = pathFrom(v);
  const rejectedPath = pathFrom(r);

  const last = days[days.length - 1];
  const lastV = last ? last.verified : 0;
  const lastR = last ? last.rejected : 0;

  const xLast = days.length ? xAt(days.length - 1) : padX;
  const yLastV = yAt(lastV);
  const yLastR = yAt(lastR);

  // grid lines: 0%, 50%, 100%
  const gridYs = [0, 0.5, 1].map((t) => padY + t * (height - padY * 2));

  if (!days.length) {
    return (
      <div className={styles.sparkEmpty}>
        No daily data yet. Approve/reject a few works to build a trend.
      </div>
    );
  }

  return (
    <div className={styles.sparkInner}>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.sparkSvg} role="img" aria-label="7-day trend">
        {/* background grid */}
        {gridYs.map((y, idx) => (
          <line
            key={idx}
            x1={padX}
            y1={y}
            x2={width - padX}
            y2={y}
            className={styles.sparkGrid}
          />
        ))}

        {/* lines */}
        <path d={verifiedPath} className={styles.lineOk} />
        <path d={rejectedPath} className={styles.lineBad} />

        {/* endpoints */}
        <circle cx={xLast} cy={yLastV} r={4} className={styles.dotOkFill} />
        <circle cx={xLast} cy={yLastR} r={4} className={styles.dotBadFill} />

        {/* x labels (first & last) */}
        <text x={padX} y={height - 6} className={styles.sparkText}>
          {days[0]?.date?.slice(5) ?? ""}
        </text>
        <text x={width - padX} y={height - 6} textAnchor="end" className={styles.sparkText}>
          {days[days.length - 1]?.date?.slice(5) ?? ""}
        </text>
      </svg>

      <div className={styles.sparkFooter}>
        <div className={styles.sparkKpi}>
          <span className={`${styles.kpiDot} ${styles.dotOk}`} />
          <span className={styles.kpiLabel}>Today verified</span>
          <strong className={styles.kpiValue}>{lastV}</strong>
        </div>

        <div className={styles.sparkKpi}>
          <span className={`${styles.kpiDot} ${styles.dotBad}`} />
          <span className={styles.kpiLabel}>Today rejected</span>
          <strong className={styles.kpiValue}>{lastR}</strong>
        </div>

        <div className={styles.sparkKpi}>
          <span className={`${styles.kpiDot} ${styles.dotInfo}`} />
          <span className={styles.kpiLabel}>Pending now</span>
          <strong className={styles.kpiValue}>{pendingTotal}</strong>
        </div>
      </div>
    </div>
  );
}

/* ================= Skeleton ================= */

function SkeletonCard() {
  return (
    <div className={`${styles.card} ${styles.skeleton}`} aria-hidden="true">
      <div className={styles.cardTop}>
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonDot} />
      </div>
      <div className={styles.skeletonValue} />
    </div>
  );
}
