export function safeLoad<T>(key: string): T {
  if (typeof window === "undefined") return [] as T;
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [] as T;
  }
}

export function safeSave<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}
