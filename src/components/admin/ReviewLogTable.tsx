"use client";

import type { ReviewLog } from "@/lib/reviewLogStore";
import styles from "@/styles/admin/reviewTable.module.css";

export default function ReviewLogTable({
  logs,
}: {
  logs: ReviewLog[];
}) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Tác phẩm</th>
          <th>Hành động</th>
          <th>Admin</th>
          <th>Vai trò</th>
          <th>Thời gian</th>
        </tr>
      </thead>
      <tbody>
        {logs.map(log => (
          <tr key={log.id}>
            <td>{log.workTitle}</td>
            <td>{log.action}</td>
            <td>{log.adminEmail}</td>
            <td>{log.adminRole}</td>
            <td>{new Date(log.time).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
