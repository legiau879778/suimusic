"use client";

import type { ReviewLog } from "@/lib/reviewLogStore";

export default function ReviewChart({
  logs,
}: {
  logs: ReviewLog[];
}) {
  const byDate: Record<string, number> = {};

  logs.forEach(l => {
    const d = new Date(l.time).toLocaleDateString();
    byDate[d] = (byDate[d] || 0) + 1;
  });

  return (
    <div>
      <h3>📈 Hoạt động theo ngày</h3>
      {Object.entries(byDate).map(([d, c]) => (
        <div key={d}>
          {d}: {c}
        </div>
      ))}
    </div>
  );
}
