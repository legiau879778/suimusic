"use client";

import type { ReviewLog } from "@/lib/reviewLogStore";

export default function ReviewStats({
  logs,
}: {
  logs: ReviewLog[];
}) {
  const today = new Date().toDateString();

  const todayLogs = logs.filter(
    l => new Date(l.time).toDateString() === today
  );

  return (
    <div>
      <strong>📊 Hôm nay</strong>
      <p>✔ Duyệt: {todayLogs.filter(l => l.action === "approved").length}</p>
      <p>✖ Từ chối: {todayLogs.filter(l => l.action === "rejected").length}</p>
      <p>🧾 Tổng: {todayLogs.length}</p>
    </div>
  );
}
