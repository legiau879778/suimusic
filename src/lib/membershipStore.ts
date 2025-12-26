import { suiClient } from "./suiClient";

export type MembershipType = "artist" | "creator" | "business";
export type CreatorPlan = "starter" | "pro" | "studio";
export type ArtistPlan = "1m" | "3m" | "1y";

export type Membership = {
  type: MembershipType;
  plan?: CreatorPlan | ArtistPlan;
  expireAt: number;
  txHash: string;
  paidAmountSui?: number;
};

export const RECEIVER = "0xb2bbf1bc2ce439c95ff862692cd32d80d025749711df2d7fe6d263ca1d45111a";

export const PRICES_SUI = {
  artist_1m: 0.01,
  artist_3m: 0.02,
  artist_1y: 0.03,
  creator_starter_month: 0.01,
  creator_pro_month: 0.02,
  creator_studio_month: 0.05,
  business_year: 0.05,
} as const;

// --- LOGIC TÍNH TOÁN ---

export function getMembershipPriceSui(m: Pick<Membership, "type" | "plan">): number {
  if (m.type === "artist") {
    if (m.plan === "1m") return PRICES_SUI.artist_1m;
    if (m.plan === "3m") return PRICES_SUI.artist_3m;
    return PRICES_SUI.artist_1y;
  }
  if (m.type === "business") return PRICES_SUI.business_year;
  if (m.plan === "starter") return PRICES_SUI.creator_starter_month;
  if (m.plan === "pro") return PRICES_SUI.creator_pro_month;
  return PRICES_SUI.creator_studio_month;
}

export function getMembershipDurationMs(m: Pick<Membership, "type" | "plan">): number {
  const DAY = 24 * 60 * 60 * 1000;
  if (m.type === "artist") {
    if (m.plan === "1m") return 30 * DAY;
    if (m.plan === "3m") return 90 * DAY;
    return 365 * DAY;
  }
  if (m.type === "business") return 365 * DAY;
  return 30 * DAY;
}

export function getMembershipBadgeLabel(m: Membership): string {
  const p = m.plan ? ` • ${m.plan.toUpperCase()}` : "";
  return `${m.type.toUpperCase()}${p}`;
}

export function getMembershipEntitlements(m: Membership | null) {
  const type = m?.type;
  return {
    canManage: type === "artist",
    canRegister: type === "artist",
    canTrade: type === "creator" || type === "business",
  };
}

// --- HÀM BỔ SUNG ĐỂ FIX LỖI IMPORT (SEARCH/HEADER) ---

/**
 * Lấy membership đang hoạt động (không bị hết hạn)
 */
export function getActiveMembership(
  input: Membership | null | { userId: string; email: string }
): Membership | null {
  if (!input) return null;
  if (typeof (input as any).expireAt === "number") {
    const m = input as Membership;
    if (m.expireAt < Date.now()) return null;
    return m;
  }
  const { userId, email } = input as { userId: string; email: string };
  const cached = getCachedMembership(userId, email);
  if (!cached) return null;
  if (cached.expireAt < Date.now()) return null;
  return cached;
}

/**
 * Lấy dữ liệu từ LocalStorage để hiển thị nhanh (Cache)
 */
export function getCachedMembership(userId: string, email: string): Membership | null {
  if (typeof window === "undefined") return null;
  const key = `membership_${userId}_${email}`;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Membership;
    if (data.expireAt < Date.now()) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Lưu dữ liệu vào LocalStorage
 */
export function saveMembershipCache(userId: string, email: string, m: Membership) {
  if (typeof window === "undefined") return;
  const key = `membership_${userId}_${email}`;
  localStorage.setItem(key, JSON.stringify(m));
}
