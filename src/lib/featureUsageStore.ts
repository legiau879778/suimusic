// src/lib/featureUsageStore.ts

export type FeatureKey = "music_use";

function key(userId: string) {
  return `chainstorm_usage:${userId}`;
}

type UsageState = Record<FeatureKey, number>;

function load(userId: string): UsageState {
  if (typeof window === "undefined") return { music_use: 0 };
  try {
    return JSON.parse(localStorage.getItem(key(userId)) || '{"music_use":0}');
  } catch {
    return { music_use: 0 };
  }
}

function save(userId: string, data: UsageState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(userId), JSON.stringify(data));
}

export function getUsage(userId: string, feature: FeatureKey): number {
  return load(userId)[feature] ?? 0;
}

export function incUsage(userId: string, feature: FeatureKey, by = 1) {
  const state = load(userId);
  state[feature] = (state[feature] ?? 0) + by;
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
