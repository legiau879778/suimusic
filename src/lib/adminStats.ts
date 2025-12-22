import { Work } from "@/lib/workStore";

export type ApprovalByDay = {
  date: string;
  verified: number;
  rejected: number;
};

export function buildAdminStats(works: Work[]) {
  const verified = works.filter(w => w.status === "verified");
  const rejected = works.filter(w => w.status === "rejected");

  const approvalByDay: Record<
    string,
    { verified: number; rejected: number }
  > = {};

  /* ===== VERIFIED ===== */
  verified.forEach(w => {
    if (!w.verifiedAt) return;

    const d = new Date(w.verifiedAt)
      .toISOString()
      .slice(0, 10);

    approvalByDay[d] ||= {
      verified: 0,
      rejected: 0,
    };

    approvalByDay[d].verified++;
  });

  /* ===== REJECTED ===== */
  rejected.forEach(w => {
    if (!w.rejectedAt) return;

    const d = new Date(w.rejectedAt)
      .toISOString()
      .slice(0, 10);

    approvalByDay[d] ||= {
      verified: 0,
      rejected: 0,
    };

    approvalByDay[d].rejected++;
  });

  const approvalStats: ApprovalByDay[] =
    Object.entries(approvalByDay).map(
      ([date, v]) => ({
        date,
        verified: v.verified,
        rejected: v.rejected,
      })
    );

  return {
    approvalByDay: approvalStats,
  };
}
