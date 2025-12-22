"use client";

import { useEffect, useState } from "react";
import styles from "@/styles/admin/chart.module.css";
import { getAllWorks } from "@/lib/workStore";

export default function ApprovalLineChart() {
  const [data, setData] = useState<any[]>([]);

  const build = () => {
    const works = getAllWorks();
    const map: Record<string, any> = {};

    works.forEach((w) => {
      const date =
        (w.verifiedAt || w.rejectedAt || "")
          .slice(0, 10);

      if (!date) return;

      map[date] ||= { verified: 0, rejected: 0 };

      if (w.status === "verified")
        map[date].verified++;
      if (w.status === "rejected")
        map[date].rejected++;
    });

    setData(
      Object.entries(map).map(([d, v]) => ({
        date: d,
        ...v,
      }))
    );
  };

  useEffect(() => {
    build();
    window.addEventListener("review-log-updated", build);
    return () =>
      window.removeEventListener(
        "review-log-updated",
        build
      );
  }, []);

  return (
    <div className={styles.wrap}>
      <h3>Thống kê duyệt theo ngày</h3>

      {data.map((d) => (
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
