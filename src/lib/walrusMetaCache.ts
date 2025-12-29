import { toGateway } from "@/lib/profileStore";

type CacheEntry = {
  json: any | null;
  cachedAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<any | null>>();

function now() {
  return Date.now();
}

function getKey(input: string) {
  return input.trim().toLowerCase();
}

export async function fetchWalrusMetadata(metaInput: string) {
  const raw = String(metaInput || "").trim();
  if (!raw) return null;

  const key = getKey(raw);
  const cached = cache.get(key);
  if (cached && now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.json;
  }

  const existing = pending.get(key);
  if (existing) return existing;

  const task = (async () => {
    try {
      const url = toGateway(raw);
      if (!url) return null;

      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) {
        cache.set(key, { json: null, cachedAt: now() });
        return null;
      }

      const json = await res.json();
      cache.set(key, { json, cachedAt: now() });
      return json;
    } catch {
      cache.set(key, { json: null, cachedAt: now() });
      return null;
    } finally {
      pending.delete(key);
    }
  })();

  pending.set(key, task);
  return task;
}
