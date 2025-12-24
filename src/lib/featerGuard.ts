// src/lib/featureGuard.ts
import type { Membership } from "./membershipStore";
import { getFeaturePolicy } from "./membershipStore";
import { getUsage } from "./featureUsageStore";

/**
 * Check feature-level quyền "sử dụng nhạc"
 */
export function canUseMusicFeature(params: {
  userId: string;
  membership: Membership | null;
}) {
  const { userId, membership } = params;
  const policy = getFeaturePolicy(membership);

  // chỉ creator mới có use music theo gói
  if (!membership || membership.type !== "creator") {
    return { ok: false, reason: "Bạn cần gói CREATOR để sử dụng nhạc" };
  }

  if (policy.musicUseUnlimited) {
    return { ok: true, remaining: Infinity as any };
  }

  const limit = policy.musicUseLimit;
  const used = getUsage(userId, "music_use");
  const remaining = Math.max(0, limit - used);

  if (remaining <= 0) {
    return { ok: false, reason: `Bạn đã dùng hết ${limit} lượt (Starter). Nâng cấp Pro/Studio để không giới hạn.` };
  }

  return { ok: true, remaining };
}
