type MembershipType = "artist" | "creator" | "business";

type Membership = {
  type: MembershipType;
  expireAt: number;
};

function getMembership(): Membership | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem("membership");
  if (!raw) return null;

  const m = JSON.parse(raw);
  if (m.expireAt < Date.now()) return null;

  return m;
}

/* =========================
   QUYỀN TRUY CẬP MENU
========================= */

export function canAccessMenu(
  key: "manage" | "register" | "trade"
) {
  const m = getMembership();
  if (!m) return false;

  switch (key) {
    case "manage":
    case "register":
      return m.type === "artist";

    case "trade":
      return m.type === "creator" || m.type === "business";

    default:
      return false;
  }
}
