"use client";

import { useEffect, useState } from "react";
import styles from "@/styles/admin/table.module.css";
import { getReviewLogs } from "@/lib/reviewLogStore";
import { exportCSV } from "@/lib/exportCsv";

export default function ReviewLogTable() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    setLogs(getReviewLogs());

    const update = () => setLogs(getReviewLogs());
    window.addEventListener("review-log-updated", update);
    window.addEventListener("storage", update);

    return () => {
      window.removeEventListener("review-log-updated", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return (
    <div className={styles.card}>
      <button
        className={styles.export}
        onClick={() => exportCSV("review_logs.csv", logs)}
      >
        Export CSV
      </button>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Tác phẩm</th>
            <th>Admin</th>
            <th>Hành động</th>
            <th>Thời gian</th>
          </tr>
        </thead>

        <tbody>
          {logs.map(l => (
            <tr key={l.id}>
              <td>{l.workTitle}</td>
              <td>{l.adminEmail}</td>
              <td>{l.action}</td>
              <td>{l.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
