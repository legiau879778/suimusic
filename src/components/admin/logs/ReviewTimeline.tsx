"use client";

import type { ReviewLog } from "@/lib/reviewLogStore";

export default function ReviewTimeline({
  logs,
}: {
  logs: ReviewLog[];
}) {
  return (
    <ul>
      {logs
        .slice()
        .reverse()
        .slice(0, 8)
        .map(l => (
          <li key={l.id}>
            {l.action === "approved" ? "✅" : "❌"}{" "}
            {l.workTitle} – {l.adminEmail}
          </li>
        ))}
    </ul>
  );
}
