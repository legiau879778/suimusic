// src/lib/tradeStore.ts
"use client";

export type TradeStatus = "success" | "pending" | "failed";
export type TradeType = "buy" | "sell" | "license";

export type Trade = {
  id: string;
  userId: string;

  type: TradeType;
  title: string;

  amountSui: number;
  txHash: string;

  status: TradeStatus;
  createdAt: number;

  // optional
  workId?: string;
};

const KEY = "chainstorm_trades";
export const TRADES_UPDATED_EVENT = "chainstorm_trades_updated";

function keyByUser(userId: string) {
  return `${KEY}:${userId}`;
}

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TRADES_UPDATED_EVENT));
}

function safeParse(raw: string | null): Trade[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr as Trade[];
  } catch {
    return [];
  }
}

export function getUserTrades(userId: string): Trade[] {
  if (typeof window === "undefined") return [];
  if (!userId) return [];
  return safeParse(localStorage.getItem(keyByUser(userId)));
}

export function setUserTrades(userId: string, trades: Trade[]) {
  if (typeof window === "undefined") return;
  if (!userId) return;
  localStorage.setItem(keyByUser(userId), JSON.stringify(trades));
  emit();
}

export function addTrade(userId: string, trade: Omit<Trade, "userId">) {
  if (typeof window === "undefined") return;
  if (!userId) return;

  const curr = getUserTrades(userId);
  const next: Trade[] = [
    { ...trade, userId },
    ...curr,
  ];

  localStorage.setItem(keyByUser(userId), JSON.stringify(next));
  emit();
}

export function updateTradeStatus(userId: string, txHash: string, status: TradeStatus) {
  if (typeof window === "undefined") return;
  if (!userId || !txHash) return;

  const curr = getUserTrades(userId);
  let changed = false;

  const next = curr.map((t) => {
    if (t.txHash !== txHash) return t;
    if (t.status === status) return t;
    changed = true;
    return { ...t, status };
  });

  if (changed) {
    localStorage.setItem(keyByUser(userId), JSON.stringify(next));
    emit();
  }
}

/**
 * Realtime subscribe (same-tab event + cross-tab storage)
 */
export function subscribeTrades(userId: string, cb: () => void) {
  if (typeof window === "undefined") return () => {};

  const onEvent = () => cb();

  const onStorage = (e: StorageEvent) => {
    const k = e.key || "";
    if (k === keyByUser(userId)) cb();
  };

  window.addEventListener(TRADES_UPDATED_EVENT, onEvent);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(TRADES_UPDATED_EVENT, onEvent);
    window.removeEventListener("storage", onStorage);
  };
}
