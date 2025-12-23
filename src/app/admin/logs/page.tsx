"use client";

import { useEffect, useState } from "react";
import { getReviewLogs } from "@/lib/reviewLogStore";
import type { ReviewLog } from "@/lib/reviewLogStore";

import AdminGuard from "@/components/admin/AdminGuard";
import ReviewTable from "@/components/admin/logs/ReviewTable";
import ReviewTimeline from "@/components/admin/logs/ReviewTimeline";
import ReviewChart from "@/components/admin/logs/ReviewChart";

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<ReviewLog[]>([]);

  useEffect(() => {
    setLogs(getReviewLogs());
  }, []);

  return (
    <AdminGuard>
      <h1>Admin Review Logs</h1>

      <ReviewChart logs={logs} />
      <ReviewTimeline logs={logs} />
      <ReviewTable logs={logs} />
    </AdminGuard>
  );
}
