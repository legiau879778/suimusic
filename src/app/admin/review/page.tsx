"use client";

import { useEffect, useState } from "react";
import { getReviewLogs } from "@/lib/reviewLogStore";
import type { ReviewLog } from "@/lib/reviewLogStore";

import AdminGuard from "@/components/admin/AdminGuard";
import ReviewStats from "@/components/admin/logs/ReviewStats";
import ReviewChart from "@/components/admin/logs/ReviewChart";
import ReviewTimeline from "@/components/admin/logs/ReviewTimeline";
import ReviewTable from "@/components/admin/logs/ReviewTable";

export default function AdminReviewPage() {
  const [logs, setLogs] = useState<ReviewLog[]>([]);

  useEffect(() => {
    setLogs(getReviewLogs());
  }, []);

  return (
    <AdminGuard>
      <h1>Dashboard duyệt tác phẩm</h1>

      <ReviewStats logs={logs} />
      <ReviewChart logs={logs} />
      <ReviewTimeline logs={logs} />
      <ReviewTable logs={logs} />
    </AdminGuard>
  );
}
