"use client";

import { useEffect, useState } from "react";
import { getReviewLogs } from "@/lib/reviewLogStore";
import type { ReviewLog } from "@/lib/reviewLogStore";
import ReviewLogTable from "@/components/admin/ReviewLogTable";

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<ReviewLog[]>([]);

  useEffect(() => {
    setLogs(getReviewLogs());
  }, []);

  return (
    <>
      <h1>Log duyệt</h1>
      <ReviewLogTable logs={logs} />
    </>
  );
}
