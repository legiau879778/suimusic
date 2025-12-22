"use client";

import styles from "@/styles/admin/chart.module.css";
import { ApprovalByDay } from "@/lib/adminStats";

type Props = {
  data: ApprovalByDay[];
};

export default function ApprovalChart({ data }: Props) {
  if (!data || data.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <h3>Thống kê duyệt theo ngày</h3>

      {data.map(d => (
        <div key={d.date} className={styles.barRow}>
          <span>{d.date}</span>

          <div className={styles.bar}>
            <div
              className={styles.verified}
              style={{ width: d.verified * 20 }}
            />
            <div
              className={styles.rejected}
              style={{ width: d.rejected * 20 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
