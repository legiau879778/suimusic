"use client";

import { useMemo } from "react";
import { getWorks } from "@/lib/workStore";
import { buildAdminStats } from "@/lib/adminStats";
import ApprovalChart from "@/components/admin/ApprovalLineChart";

export default function AdminStatsPage() {
  // ✅ Load works 1 lần
  const works = useMemo(() => getWorks(), []);

  // ✅ Build stats từ SOURCE DUY NHẤT
  const { approvalByDay } = useMemo(
    () => buildAdminStats(works),
    [works]
  );

  return (
    <>
      <h1>Thống kê duyệt</h1>
      <ApprovalChart data={approvalByDay} />
    </>
  );
}
