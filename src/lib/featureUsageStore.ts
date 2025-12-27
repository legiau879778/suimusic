// src/lib/featureUsageStore.ts

export type FeatureKey = "music_use";

function key(userId: string) {
  return `chainstorm_usage:${userId}`;
}

type UsageState = {
  day: string;
  usage: Record<FeatureKey, number>;
};

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function nextResetAt() {
  const n = new Date();
  n.setHours(24, 0, 0, 0);
  return n.getTime();
}

function load(userId: string): UsageState {
  if (typeof window === "undefined") {
    return { day: todayKey(), usage: { music_use: 0 } };
  }
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) {
      return { day: todayKey(), usage: { music_use: 0 } };
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed?.day === "string" && parsed?.usage) {
      const day = parsed.day;
      if (day !== todayKey()) {
        return { day: todayKey(), usage: { music_use: 0 } };
      }
      return {
        day,
        usage: {
          music_use: Number(parsed.usage?.music_use ?? 0),
        },
      };
    }
    const legacy = Number(parsed?.music_use ?? 0);
    return { day: todayKey(), usage: { music_use: legacy } };
  } catch {
    return { day: todayKey(), usage: { music_use: 0 } };
  }
}

function save(userId: string, data: UsageState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(userId), JSON.stringify(data));
}

export function getUsage(userId: string, feature: FeatureKey): number {
  return load(userId).usage[feature] ?? 0;
}

export function incUsage(userId: string, feature: FeatureKey, by = 1) {
  const state = load(userId);
  state.usage[feature] = (state.usage[feature] ?? 0) + by;
  save(userId, state);

  // optional realtime
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("usage_updated"));
  }
}

export function resetUsage(userId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key(userId));
}

export function getUsageStatus(
  userId: string,
  feature: FeatureKey,
  limit: number
) {
  const state = load(userId);
  const used = Math.max(0, Number(state.usage[feature] ?? 0));
  const remaining = Math.max(0, limit - used);
  return {
    used,
    remaining,
    limit,
    resetAt: nextResetAt(),
  };
}
