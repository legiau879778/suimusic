"use client";

import { useEffect, useState } from "react";
import { getReviewLogs } from "@/lib/reviewLogStore";
import type { ReviewLog } from "@/lib/reviewLogStore";

import AdminGuard from "@/components/admin/AdminGuard";
import ReviewLogTable from "@/components/admin/logs/ReviewLogTable";

export default function AdminLogsPage() {
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<ReviewLog[]>([]);

  useEffect(() => {
    setMounted(true);
    setLogs(getReviewLogs());

    const reload = () =>
      setLogs(getReviewLogs());

    window.addEventListener(
      "review-log-updated",
      reload
    );
    return () =>
      window.removeEventListener(
        "review-log-updated",
        reload
      );
  }, []);

  if (!mounted) return null;

  return (
    <AdminGuard>
      <h1>Review history</h1>
      <ReviewLogTable logs={logs} />
    </AdminGuard>
  );
}
