export type AiLyricsItem = {
  id: string;
  prompt: string;
  genre: string;
  language: string;
  lyrics: string;
  createdAt: number;
};

export const AI_LYRICS_EVENT = "ai_lyrics_updated";

function getKey(userId?: string) {
  const id = String(userId || "guest").trim() || "guest";
  return `ai_lyrics_history:${id}`;
}

export function loadAiLyrics(userId?: string): AiLyricsItem[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(getKey(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AiLyricsItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item.id && item.lyrics)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function addAiLyrics(userId: string | undefined, item: AiLyricsItem) {
  if (typeof window === "undefined") return;
  const current = loadAiLyrics(userId);
  const next = [item, ...current].slice(0, 50);
  window.localStorage.setItem(getKey(userId), JSON.stringify(next));
  window.dispatchEvent(new Event(AI_LYRICS_EVENT));
}

export function removeAiLyrics(userId: string | undefined, id: string) {
  if (typeof window === "undefined") return;
  const current = loadAiLyrics(userId);
  const next = current.filter((item) => item.id !== id);
  window.localStorage.setItem(getKey(userId), JSON.stringify(next));
  window.dispatchEvent(new Event(AI_LYRICS_EVENT));
}
