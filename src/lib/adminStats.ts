import { getWorks } from "./workStore";
import { getUsers } from "./userStore";

export function getAdminStats() {
  const works = getWorks() || [];
  const users = getUsers() || [];

  const verified = works.filter(w => w.status === "verified");
  const pending = works.filter(w => w.status === "pending");
  const rejected = works.filter(w => w.status === "rejected");

  const approvalByDay: Record<string, number> = {};

  verified.forEach(w => {
    const d = new Date(w.createdAt)
      .toISOString()
      .slice(0, 10);
    approvalByDay[d] =
      (approvalByDay[d] || 0) + 1;
  });

  return {
    verified: verified.length,
    pending: pending.length,
    rejected: rejected.length,

    verifiedList: verified.map(w => w.title),

    admins: users.filter(u => u.role === "admin").length,
    users: users.filter(u => u.role === "user").length,

    approvalByDay: Object.entries(approvalByDay).map(
      ([date, count]) => ({ date, count })
    ), // ✅ LUÔN LÀ ARRAY
  };
}
