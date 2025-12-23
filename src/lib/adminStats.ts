import { Work } from "@/lib/workStore";

export type ApprovalByDay = {
  date: string;
  verified: number;
  rejected: number;
};

export function buildAdminStats(
  works: Work[] = [] // ✅ FIX 1: default param
) {
  /* =====================
     SAFE GUARD
  ===================== */
  const safeWorks = Array.isArray(works) ? works : [];

  const verified = safeWorks.filter(
    (w) => w.status === "verified"
  );

  const rejected = safeWorks.filter(
    (w) => w.status === "rejected"
  );

  const approvalByDay: Record<
    string,
    { verified: number; rejected: number }
  > = {};

  /* =====================
     VERIFIED
  ===================== */
  verified.forEach((w) => {
    if (!w.verifiedAt) return;

    const date = toDateKey(w.verifiedAt);

    approvalByDay[date] ??= {
      verified: 0,
      rejected: 0,
    };

    approvalByDay[date].verified += 1;
  });

  /* =====================
     REJECTED
  ===================== */
  rejected.forEach((w) => {
    if (!w.rejectedAt) return;

    const date = toDateKey(w.rejectedAt);

    approvalByDay[date] ??= {
      verified: 0,
      rejected: 0,
    };

    approvalByDay[date].rejected += 1;
  });

  /* =====================
     SORT + MAP
  ===================== */
  const approvalStats: ApprovalByDay[] =
    Object.entries(approvalByDay)
      .sort(([a], [b]) => a.localeCompare(b)) // ✅ FIX 3: sort theo ngày
      .map(([date, v]) => ({
        date,
        verified: v.verified,
        rejected: v.rejected,
      }));

  return {
    total: safeWorks.length,
    verified: verified.length,
    rejected: rejected.length,
    pending: safeWorks.filter(
      (w) => w.status === "pending"
    ).length,
    approvalByDay: approvalStats,
  };
}

/* =====================
   UTIL
===================== */
function toDateKey(date: string | number | Date) {
  return new Date(date).toISOString().slice(0, 10);
}
