export type TradeLog = {
  id: string;
  userId: string;
  workTitle: string;
  price: string;
  txHash?: string;
  time: string;
};

const KEY = "chainstorm_trades";

/* ================= STORAGE ================= */

function load(): TradeLog[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function save(data: TradeLog[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(data));
}

/* ================= ADD ================= */

export function addTrade(log: Omit<TradeLog, "id" | "time">) {
  const trades = load();

  trades.push({
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    ...log,
  });

  save(trades);
}

/* ================= GET ================= */

export function getTradesByUser(userId: string): TradeLog[] {
  return load().filter((t) => t.userId === userId);
}

export function getAllTrades(): TradeLog[] {
  return load();
}
