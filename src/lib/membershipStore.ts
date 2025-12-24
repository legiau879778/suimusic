// src/lib/membershipStore.ts
import { suiClient } from "./suiClient";

/* ================= TYPES ================= */

export type MembershipType = "artist" | "creator" | "business";
export type CreatorPlan = "starter" | "pro" | "studio";

export type Membership = {
  type: MembershipType;
  plan?: CreatorPlan;
  expireAt: number;
  txHash: string;
  paidAmountSui?: number;
};

/* ================= CONFIG ================= */

export const RECEIVER =
  "0xb2bbf1bc2ce439c95ff862692cd32d80d025749711df2d7fe6d263ca1d45111a";

/* ================= STORAGE KEY (PER USER) ================= */

function getKey(userId: string) {
  return `chainstorm_membership:${userId}`;
}

/* ================= PRICING ================= */

export const PRICES_SUI = {
  artist_year: 30,
  creator_starter_month: 5,
  creator_pro_month: 15,
  creator_studio_month: 40,
  business_year: 60,
} as const;

export function getMembershipPriceSui(
  m: Pick<Membership, "type" | "plan">
): number {
  if (m.type === "artist") return PRICES_SUI.artist_year;
  if (m.type === "business") return PRICES_SUI.business_year;

  if (m.plan === "starter") return PRICES_SUI.creator_starter_month;
  if (m.plan === "pro") return PRICES_SUI.creator_pro_month;
  return PRICES_SUI.creator_studio_month;
}

export function getMembershipDurationMs(
  m: Pick<Membership, "type" | "plan">
): number {
  const DAY = 24 * 60 * 60 * 1000;
  if (m.type === "artist") return 365 * DAY;
  if (m.type === "business") return 365 * DAY;
  return 30 * DAY; // creator
}

export function isMembershipActive(m: Membership) {
  return Date.now() < m.expireAt;
}

/* ================= FEATURE LIMITS ================= */

export const CREATOR_STARTER_MUSIC_USE_LIMIT = 20;

export function getFeaturePolicy(m: Membership | null) {
  const type = m?.type;

  return {
    // menu
    canManage: type === "artist",
    canRegister: type === "artist",
    canTrade: type === "creator" || type === "business",

    // creator plan flags
    creatorPlan: type === "creator" ? m?.plan : undefined,
    creatorUnlimited:
      type === "creator"
        ? m?.plan === "pro" || m?.plan === "studio"
        : false,
    creatorTeam:
      type === "creator" ? m?.plan === "studio" : false,

    // feature-level
    musicUseUnlimited:
      type === "creator"
        ? m?.plan === "pro" || m?.plan === "studio"
        : false,
    musicUseLimit:
      type === "creator" && m?.plan === "starter"
        ? CREATOR_STARTER_MUSIC_USE_LIMIT
        : 0,
  };
}

/* ================= LABEL (UI) ================= */

export function getMembershipBadgeLabel(m: Membership): string {
  if (m.type === "creator") {
    const p = m.plan ? ` • ${m.plan.toUpperCase()}` : "";
    return `CREATOR${p}`;
  }
  return m.type.toUpperCase();
}

/* ================= ON-CHAIN VERIFY ================= */

export async function verifyMembership(
  m: Membership
): Promise<boolean> {
  try {
    if (!m?.txHash) return false;
    if (!isMembershipActive(m)) return false;

    const tx = await suiClient.getTransactionBlock({
      digest: m.txHash,
      options: {
        showEffects: true,
        showBalanceChanges: true,
      },
    });

    if (tx.effects?.status.status !== "success")
      return false;

    const expectedSui = getMembershipPriceSui(m);
    if (expectedSui <= 0) return false;

    const expectedMist = BigInt(
      Math.floor(expectedSui * 1e9)
    );
    const ZERO = BigInt(0);
    const NEG_ONE = BigInt(-1);

    const paid = (tx.balanceChanges ?? []).some(
      (b: any) => {
        const owner = b.owner?.AddressOwner;
        if (!owner) return false;
        if (
          owner.toLowerCase() !==
          RECEIVER.toLowerCase()
        )
          return false;

        try {
          const amt = BigInt(b.amount);

          /* ✅ không dùng BigInt literal */
          const abs =
            amt < ZERO ? amt * NEG_ONE : amt;

          return abs >= expectedMist;
        } catch {
          return (
            Math.abs(Number(b.amount)) >=
            Number(expectedMist)
          );
        }
      }
    );

    return paid;
  } catch {
    return false;
  }
}

/* ================= PUBLIC API ================= */

export async function getActiveMembership(
  userId: string
): Promise<Membership | null> {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(getKey(userId));
  if (!raw) return null;

  let m: Membership;
  try {
    m = JSON.parse(raw);
  } catch {
    localStorage.removeItem(getKey(userId));
    return null;
  }

  if (!m.type || !m.expireAt || !m.txHash) {
    localStorage.removeItem(getKey(userId));
    return null;
  }

  const ok = await verifyMembership(m);
  if (!ok) {
    localStorage.removeItem(getKey(userId));
    return null;
  }

  return m;
}

export function saveMembership(
  userId: string,
  m: Membership
) {
  if (typeof window === "undefined") return;
  localStorage.setItem(getKey(userId), JSON.stringify(m));
}

export function clearMembership(userId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(getKey(userId));
}

/* ================= ENTITLEMENTS (menu) ================= */

export function getMembershipEntitlements(
  m: Membership | null
) {
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
