import type { MembershipType, UserRole } from "@/context/AuthContext";

export function roleFromMembership(
  membership: MembershipType | null | undefined,
  currentRole: UserRole
): UserRole {
  // admin luôn giữ
  if (currentRole === "admin") return "admin";

  if (!membership) return "user";

  if (membership === "artist" || membership === "business") return "author";

  // creator: vẫn là user nhưng có entitlements trade
  if (membership === "creator") return "user";

  // ai: tuỳ bạn, hiện coi như user
  return "user";
}
