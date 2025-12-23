"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { buildAdminStats } from "@/lib/adminStats";
import { getWorks } from "@/lib/workStore";

export default function ApprovalChart() {
  const { approvalByDay } = buildAdminStats(getWorks());

  return (
    <LineChart width={600} height={300} data={approvalByDay}>
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip />
      <Line dataKey="verified" stroke="#fde047" />
      <Line dataKey="rejected" stroke="#ef4444" />
    </LineChart>
  );
}
