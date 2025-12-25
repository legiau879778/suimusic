"use client";

import type { User } from "@/context/AuthContext";
import { getActiveMembership } from "@/lib/membershipStore";

/**
 * Policy role theo membership (bạn có thể chỉnh theo đồ án)
 * - admin giữ nguyên
 * - có membership => tối thiểu author để mở menu
 * - nếu không có membership thì cần wallet verified mới lên author
 */
export function mapRoleFromMembership(
  u: User,
  membershipType: User["membership"]
) {
  if (u.role === "admin") return "admin";

  const hasVerifiedWallet = !!u.wallet?.address && !!u.wallet?.verified;

  if (membershipType) return "author";
  return hasVerifiedWallet ? "author" : "user";
}

/**
 * ✅ sync membership từ store -> user.membership + role
 * - getActiveMembership({ userId, email }) sẽ dùng verify + cached (sau khi bạn fix store)
 */
export async function syncUserMembershipAndRole(u: User): Promise<User> {
  const userId = (u.id || "").trim();
  const email = (u.email || "").trim();
  if (!userId) return u;

  const m = await getActiveMembership({ userId, email }).catch(() => null);
  const membershipType = (m?.type ?? null) as User["membership"];

  const nextRole = mapRoleFromMembership(u, membershipType);

  if ((u.membership ?? null) === membershipType && u.role === nextRole) return u;

  return {
    ...u,
    membership: membershipType,
    role: nextRole,
  };
}
