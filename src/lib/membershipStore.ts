export type Membership = {
  type: "artist" | "creator" | "business";
  plan?: "starter" | "pro" | "studio";
  expireAt: number;
};

export function getActiveMembership(): Membership | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem("membership");
  if (!raw) return null;

  const m = JSON.parse(raw);
  if (m.expireAt < Date.now()) return null;

  return m;
}
