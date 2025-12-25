// src/lib/membershipStore.ts
import { suiClient } from "./suiClient";

/* ================= TYPES ================= */

export type MembershipType = "artist" | "creator" | "business";

export type CreatorPlan = "starter" | "pro" | "studio";
export type ArtistPlan = "1m" | "3m" | "1y";

export type Membership = {
  type: MembershipType;

  // ✅ plan theo type
  plan?: CreatorPlan | ArtistPlan;

  expireAt: number;
  txHash: string;
  paidAmountSui?: number;

  // optional
  nftId?: string;
};

/* ================= CONFIG ================= */

export const RECEIVER =
  "0xb2bbf1bc2ce439c95ff862692cd32d80d025749711df2d7fe6d263ca1d45111a";

/** ✅ bắn event để Header/Profile cập nhật ngay sau khi mua */
export const MEMBERSHIP_UPDATED_EVENT = "chainstorm_membership_updated";

/* ================= STORAGE KEY (PER USER) ================= */

const KEY = "chainstorm_membership";

function keyById(userIdOrEmail: string) {
  return `${KEY}:${userIdOrEmail}`;
}

/**
 * ✅ BACKWARD COMPAT:
 * - keyById(userId)
 * - KEY_userId (bản cũ)
 * - keyById(email)
 * - KEY_email (bản cũ)
 */
function possibleKeys(userId: string, email?: string) {
  const keys = new Set<string>();
  if (userId) {
    keys.add(keyById(userId));
    keys.add(`${KEY}_${userId}`);
  }
  if (email) {
    keys.add(keyById(email));
    keys.add(`${KEY}_${email}`);
  }
  return Array.from(keys);
}

/* ================= PRICING ================= */

export const PRICES_SUI = {
  // ✅ Artist theo kỳ hạn
  artist_1m: 2.5,
  artist_3m: 7.5,
  artist_1y: 30,

  creator_starter_month: 5,
  creator_pro_month: 15,
  creator_studio_month: 40,

  business_year: 60,
} as const;

function isArtistPlan(p: unknown): p is ArtistPlan {
  return p === "1m" || p === "3m" || p === "1y";
}

function isCreatorPlan(p: unknown): p is CreatorPlan {
  return p === "starter" || p === "pro" || p === "studio";
}

export function getMembershipPriceSui(m: Pick<Membership, "type" | "plan">): number {
  if (m.type === "artist") {
    const p = isArtistPlan(m.plan) ? m.plan : "1y";
    if (p === "1m") return PRICES_SUI.artist_1m;
    if (p === "3m") return PRICES_SUI.artist_3m;
    return PRICES_SUI.artist_1y;
  }

  if (m.type === "business") return PRICES_SUI.business_year;

  // creator
  const p = isCreatorPlan(m.plan) ? m.plan : "starter";
  if (p === "starter") return PRICES_SUI.creator_starter_month;
  if (p === "pro") return PRICES_SUI.creator_pro_month;
  return PRICES_SUI.creator_studio_month;
}

export function getMembershipDurationMs(m: Pick<Membership, "type" | "plan">): number {
  const DAY = 24 * 60 * 60 * 1000;

  if (m.type === "artist") {
    const p = isArtistPlan(m.plan) ? m.plan : "1y";
    if (p === "1m") return 30 * DAY;
    if (p === "3m") return 90 * DAY;
    return 365 * DAY;
  }

  if (m.type === "business") return 365 * DAY;

  // creator
  return 30 * DAY;
}

export function isMembershipActive(m: Membership) {
  return Date.now() < m.expireAt;
}

/* ================= FEATURE LIMITS ================= */

export const CREATOR_STARTER_MUSIC_USE_LIMIT = 20;

export function getFeaturePolicy(m: Membership | null) {
  const type = m?.type;

  // artist plan not affect entitlements, only duration/price
  const plan = m?.plan;

  return {
    // menu
    canManage: type === "artist",
    canRegister: type === "artist",
    canTrade: type === "creator" || type === "business",

    // creator plan flags
    creatorPlan: type === "creator" && isCreatorPlan(plan) ? plan : undefined,
    creatorUnlimited:
      type === "creator" && isCreatorPlan(plan) ? plan === "pro" || plan === "studio" : false,
    creatorTeam: type === "creator" && isCreatorPlan(plan) ? plan === "studio" : false,

    // feature-level
    musicUseUnlimited:
      type === "creator" && isCreatorPlan(plan) ? plan === "pro" || plan === "studio" : false,
    musicUseLimit:
      type === "creator" && plan === "starter" ? CREATOR_STARTER_MUSIC_USE_LIMIT : 0,
  };
}

/* ================= LABEL (UI) ================= */

export function getMembershipBadgeLabel(m: Membership): string {
  if (m.type === "creator") {
    const p = isCreatorPlan(m.plan) ? ` • ${m.plan.toUpperCase()}` : "";
    return `CREATOR${p}`;
  }

  if (m.type === "artist") {
    const p = isArtistPlan(m.plan) ? m.plan : undefined;
    const label = p === "1m" ? " • 1 THÁNG" : p === "3m" ? " • 3 THÁNG" : p === "1y" ? " • 1 NĂM" : "";
    return `ARTIST${label}`;
  }

  return m.type.toUpperCase();
}

/* ================= ON-CHAIN VERIFY ================= */

type VerifyResult = "ok" | "pending" | "invalid";

/**
 * ✅ Verify membership:
 * - ok: tx hợp lệ + đã trả đủ vào RECEIVER
 * - pending: chưa tìm thấy tx / RPC chưa index / demo txHash
 * - invalid: tx fail hoặc trả không đúng
 */
export async function verifyMembershipResult(m: Membership): Promise<VerifyResult> {
  try {
    if (!m?.txHash) return "invalid";
    if (!isMembershipActive(m)) return "invalid";

    // ✅ DEMO MODE
    const verifyEnabled =
      typeof process !== "undefined"
        ? process.env.NEXT_PUBLIC_MEMBERSHIP_VERIFY !== "0"
        : true;

    if (!verifyEnabled) return "ok";

    // demo txHash
    if (m.txHash.startsWith("demo_")) return "ok";

    const tx = await suiClient.getTransactionBlock({
      digest: m.txHash,
      options: {
        showEffects: true,
        showBalanceChanges: true,
      },
    });

    if (tx.effects?.status.status !== "success") return "invalid";

    const expectedSui = getMembershipPriceSui(m);
    if (expectedSui <= 0) return "invalid";

    const expectedMist = BigInt(Math.floor(expectedSui * 1e9));
    const ZERO = BigInt(0);

    const paid = (tx.balanceChanges ?? []).some((b: any) => {
      const owner = b.owner?.AddressOwner;
      if (!owner) return false;
      if (owner.toLowerCase() !== RECEIVER.toLowerCase()) return false;

      try {
        const amt = BigInt(b.amount);
        const abs = amt < ZERO ? -amt : amt;
        return abs >= expectedMist;
      } catch {
        return Math.abs(Number(b.amount)) >= Number(expectedMist);
      }
    });

    return paid ? "ok" : "invalid";
  } catch (e: any) {
    const msg = String(e?.message || e || "").toLowerCase();
    const notFound =
      msg.includes("not found") ||
      msg.includes("cannot find") ||
      msg.includes("digest") ||
      msg.includes("transaction") ||
      msg.includes("unknown") ||
      msg.includes("no transaction");

    return notFound ? "pending" : "pending";
  }
}

/* ================= INTERNAL HELPERS ================= */

function parseMembership(raw: string | null): Membership | null {
  if (!raw) return null;
  try {
    const m = JSON.parse(raw) as Membership;
    if (!m?.type || !m?.expireAt || !m?.txHash) return null;
    return m;
  } catch {
    return null;
  }
}

function emitUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MEMBERSHIP_UPDATED_EVENT));
}

/* ================= PUBLIC API ================= */

/**
 * ✅ Cached membership (NO verify) – UI không “tụt” sau refresh.
 * Chỉ check expireAt.
 */
export function getCachedMembership(userId: string, email?: string): Membership | null {
  if (typeof window === "undefined") return null;
  if (!userId) return null;

  for (const k of possibleKeys(userId, email)) {
    const m = parseMembership(localStorage.getItem(k));
    if (!m) continue;
    if (!isMembershipActive(m)) continue;
    return m;
  }

  return null;
}

/**
 * ✅ Truth membership (verify on-chain).
 * - Accept: getActiveMembership(userId) OR getActiveMembership({ userId, email })
 * - Auto migrate: nếu tìm thấy ở key email/old-key -> save về userId
 */
export async function getActiveMembership(
  arg: string | { userId: string; email?: string }
): Promise<Membership | null> {
  if (typeof window === "undefined") return null;

  const userId = typeof arg === "string" ? arg : arg.userId;
  const email = typeof arg === "string" ? undefined : arg.email;

  if (!userId) return null;

  // 1) tìm raw ở mọi key có thể
  let foundKey: string | null = null;
  let found: Membership | null = null;

  for (const k of possibleKeys(userId, email)) {
    const m = parseMembership(localStorage.getItem(k));
    if (!m) continue;
    foundKey = k;
    found = m;
    break;
  }

  if (!found || !foundKey) return null;

  // 2) verify with 3-state
  const vr = await verifyMembershipResult(found);

  if (vr === "invalid") {
    for (const k of possibleKeys(userId, email)) localStorage.removeItem(k);
    emitUpdated();
    return null;
  }

  // migrate key
  const canonical = keyById(userId);
  if (foundKey !== canonical) {
    localStorage.setItem(canonical, JSON.stringify(found));
  }

  return found;
}

/**
 * ✅ Save membership
 * - Luôn lưu theo userId
 * - Nếu có email -> lưu thêm bản copy để backward-compat
 */
export function saveMembership(userId: string, m: Membership, email?: string) {
  if (typeof window === "undefined") return;
  if (!userId) return;

  localStorage.setItem(keyById(userId), JSON.stringify(m));
  if (email) localStorage.setItem(keyById(email), JSON.stringify(m));

  emitUpdated();
}

export function clearMembership(userId: string, email?: string) {
  if (typeof window === "undefined") return;
  if (!userId) return;

  for (const k of possibleKeys(userId, email)) localStorage.removeItem(k);
  emitUpdated();
}

/* ================= ENTITLEMENTS (menu) ================= */

export function getMembershipEntitlements(m: Membership | null) {
  const p = getFeaturePolicy(m);
  return {
    canManage: p.canManage,
    canRegister: p.canRegister,
    canTrade: p.canTrade,
    creatorPlan: p.creatorPlan,
    creatorUnlimited: p.creatorUnlimited,
    creatorTeam: p.creatorTeam,
  };
}

/* ================= SUBSCRIBE (Header / Profile realtime) ================= */

/**
 * ✅ Listen membership changes:
 * - same-tab: MEMBERSHIP_UPDATED_EVENT
 * - cross-tab: storage event
 */
export function subscribeMembership(cb: () => void) {
  if (typeof window === "undefined") return () => {};

  const onEvent = () => cb();

  const onStorage = (e: StorageEvent) => {
    const k = e.key || "";
    if (k.startsWith(KEY) || k.startsWith(`${KEY}_`)) cb();
  };

  window.addEventListener(MEMBERSHIP_UPDATED_EVENT, onEvent);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(MEMBERSHIP_UPDATED_EVENT, onEvent);
    window.removeEventListener("storage", onStorage);
  };
}
