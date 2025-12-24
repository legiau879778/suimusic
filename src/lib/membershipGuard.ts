// src/lib/membershipGuard.ts
import type { Membership } from "@/lib/membershipStore";
import { getMembershipEntitlements } from "@/lib/membershipStore";

/**
 * NOTE:
 * - Header/Router đang dùng canAccessMenu("manage"|"register"|"trade")
 * - Để tránh đổi kiến trúc, mình cho phép truyền membership vào (optional)
 * - Nếu không truyền -> tự lấy từ window cached (nếu bạn muốn), nhưng hiện tại Header gọi theo membership state.
 */
export function canAccessMenu(
  perm: "manage" | "register" | "trade",
  membership?: Membership | null
): boolean {
  const ent = getMembershipEntitlements(membership ?? null);

  if (perm === "manage") return ent.canManage;
  if (perm === "register") return ent.canRegister;
  if (perm === "trade") return ent.canTrade;

  return false;
}
