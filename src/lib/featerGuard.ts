// src/lib/featureGuard.ts
import type { Membership } from "./membershipStore";
import { getFeaturePolicy } from "./membershipStore";
import { getUsageStatus } from "./featureUsageStore";

/**
 * Check feature-level quyền "sử dụng nhạc"
 */
export function canUseMusicFeature(params: {
  userId: string;
  membership: Membership | null;
}) {
  const { userId, membership } = params;
  const policy = getFeaturePolicy(membership);

  if (membership) {
    return { ok: true, remaining: Infinity as any };
  }

  const limit = Math.max(1, Number(policy.musicUseLimit || 3));
  const status = getUsageStatus(userId, "music_use", limit);

  if (status.remaining <= 0) {
    return {
      ok: false,
      remaining: 0,
      resetAt: status.resetAt,
      reason: `Bạn đã dùng hết ${limit} lượt hôm nay. Vui lòng thử lại sau.`,
    };
  }

  return {
    ok: true,
    remaining: status.remaining,
    resetAt: status.resetAt,
  };
}
