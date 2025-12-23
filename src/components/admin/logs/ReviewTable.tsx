"use client";

import type { ReviewLog } from "@/lib/reviewLogStore";

type Props = {
  logs: ReviewLog[];
};

export default function ReviewTable({ logs }: Props) {
  return (
    <table>
      <thead>
        <tr>
          <th>Thời gian</th>
          <th>Tác phẩm</th>
          <th>Hành động</th>
          <th>Admin</th>
        </tr>
      </thead>
      <tbody>
        {logs.map(l => (
          <tr key={l.id}>
            <td>{new Date(l.time).toLocaleString()}</td>
            <td>{l.workTitle}</td>
            <td>{l.action}</td>
            <td>{l.adminEmail}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
