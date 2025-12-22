"use client";

import styles from "./charts.module.css";
import { getReviewLogs } from "@/lib/reviewLogStore";

export default function LineChart() {
  const logs = getReviewLogs();

  const daily = logs.reduce<Record<string, number>>((acc, l) => {
    const d = l.time.slice(0, 10); // YYYY-MM-DD
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});

  const points = Object.entries(daily)
    .sort()
    .map(([, v], i) => `${i * 80},${200 - v * 20}`)
    .join(" ");

  return (
    <div className={styles.lineChart}>
      <h3>Hoạt động duyệt theo thời gian</h3>

      <svg width="100%" height="220">
        <polyline
          fill="none"
          stroke="#fde047"
          strokeWidth="3"
          points={points}
        />
      </svg>
    </div>
  );
}
