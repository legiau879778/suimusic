"use client";

import { useMemo } from "react";
import { getWorks } from "@/lib/workStore";
import { buildAdminStats } from "@/lib/adminStats";
import ApprovalChart from "@/components/admin/ApprovalLineChart";

export default function AdminStats() {
  const works = useMemo(() => getWorks(), []);

  const { approvalByDay } = useMemo(
    () => buildAdminStats(works),
    [works]
  );

  return (
    <section>
      <ApprovalChart data={approvalByDay} />
    </section>
  );
}
