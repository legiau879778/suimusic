"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/styles/admin/approval-chart.module.css";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { buildAdminStats } from "@/lib/adminStats";
import { getWorks } from "@/lib/workStore";

type Stat = ReturnType<typeof buildAdminStats>;

function formatDateKey(dateKey: string) {
  // dateKey = YYYY-MM-DD
  const [y, m, d] = (dateKey || "").split("-");
  if (!y || !m || !d) return dateKey;
  return `${d}/${m}`;
}

function formatTooltipLabel(label: any) {
  // label = YYYY-MM-DD
  const s = String(label || "");
  return s;
}

export default function ApprovalChart() {
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

    // ✅ same-tab event from workStore.save()
    window.addEventListener("works_updated", refresh);

    // ✅ cross-tab
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

  const data = useMemo(() => {
    // đảm bảo luôn có data (để chart không crash)
    const arr = stats?.approvalByDay || [];
    return Array.isArray(arr) ? arr : [];
  }, [stats]);

  return (
    <section className={styles.wrap}>
      {/* SUMMARY */}
      <div className={styles.grid}>
        <StatCard title="Tổng tác phẩm" value={stats.total} tone="muted" />
        <StatCard title="Đã duyệt" value={stats.verified} tone="ok" />
        <StatCard title="Bị từ chối" value={stats.rejected} tone="bad" />
        <StatCard title="Đang chờ" value={stats.pending} tone="info" />
      </div>

      {/* CHART */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}>Duyệt theo ngày</div>
            <div className={styles.cardSub}>Verified / Rejected trong 30 ngày gần nhất (nếu có)</div>
          </div>

          <div className={styles.legend}>
            <span className={styles.legItem}>
              <i className={styles.dotOk} /> Verified
            </span>
            <span className={styles.legItem}>
              <i className={styles.dotBad} /> Rejected
            </span>
          </div>
        </div>

        <div className={styles.chartBox}>
          {data.length === 0 ? (
            <div className={styles.empty}>
              Chưa có dữ liệu duyệt/từ chối để vẽ biểu đồ.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={data} margin={{ top: 12, right: 18, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateKey}
                  tick={{ fontSize: 12, opacity: 0.8 }}
                />
                <YAxis tick={{ fontSize: 12, opacity: 0.8 }} allowDecimals={false} />
                <Tooltip
                  labelFormatter={formatTooltipLabel}
                  formatter={(v: any, name: any) => [v, name]}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(2,6,23,0.92)",
                    color: "rgba(255,255,255,0.92)",
                  }}
                />

                {/* vẫn giữ màu bạn muốn */}
                <Line type="monotone" dataKey="verified" stroke="#fde047" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="rejected" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  title,
  value,
  tone = "muted",
}: {
  title: string;
  value: number;
  tone?: "ok" | "bad" | "info" | "muted";
}) {
  return (
    <div className={`${styles.stat} ${tone === "ok" ? styles.statOk : tone === "bad" ? styles.statBad : tone === "info" ? styles.statInfo : ""}`}>
      <span className={styles.statTitle}>{title}</span>
      <strong className={styles.statValue}>{value}</strong>
    </div>
  );
}
