// src/lib/workStore.ts
import { addReviewLog } from "./reviewLogStore";
import { getCurrentUser } from "./authStore";
import { getActiveAdminWallet } from "./adminWalletStore";

/* ================= TYPES ================= */

export type TradeStatus = "pending" | "accepted" | "rejected";

export type Trade = {
  id: string;
  buyer: string;
  date: string;
  status: TradeStatus;
};

export type MarketStatus = "private" | "public" | "tradeable";
export type WorkStatus = "pending" | "verified" | "rejected";

/* ===== ON-CHAIN TRADE ===== */
export type OnchainTrade = {
  buyer: string;   // wallet address
  txHash: string;
  time: number;
};

export type Work = {
  id: string;
  title: string;
  authorId: string;

  genre: string;
  language: string;
  completedDate: string;

  marketStatus: MarketStatus;
  duration: number;
  fileHash: string;

  status: WorkStatus;
  createdAt: number;
  trades: Trade[];

  /* ===== MULTI ADMIN APPROVAL ===== */
  approvalMap?: Record<string, number>; // adminEmail -> weight
  rejectionBy?: string[];               // admin reject
  quorumWeight?: number;                // total weight required

  /* ===== ON-CHAIN SYNC ===== */
  onchainTrades?: OnchainTrade[];
};

/* ================= STORAGE ================= */

const STORAGE_KEY = "works";

const load = (): Work[] => {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
};

const save = (data: Work[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

/* ================= CRUD ================= */

export const getWorks = (): Work[] => load();

export const addWork = (data: {
  title: string;
  authorId: string;
  genre: string;
  language: string;
  completedDate: string;
  marketStatus: MarketStatus;
  duration: number;
  fileHash: string;
}) => {
  const works = load();

  works.push({
    id: crypto.randomUUID(),
    title: data.title,
    authorId: data.authorId,
    genre: data.genre,
    language: data.language,
    completedDate: data.completedDate,
    marketStatus: data.marketStatus,
    duration: data.duration,
    fileHash: data.fileHash,
    status: "pending",
    createdAt: Date.now(),
    trades: [],

    approvalMap: {},
    rejectionBy: [],
    quorumWeight: 3, // ✅ default quorum
    onchainTrades: [],
  });

  save(works);
};

export const countWorksByAuthor = (authorId: string) =>
  load().filter(w => w.authorId === authorId).length;

/* ================= OFF-CHAIN TRADE (LEGACY) ================= */

export const addTrade = (workId: string, buyer: string) => {
  const works = load();
  const w = works.find(x => x.id === workId);
  if (!w) return;

  w.trades.push({
    id: crypto.randomUUID(),
    buyer,
    date: new Date().toISOString(),
    status: "pending",
  });

  save(works);
};

export const updateTradeStatus = (
  workId: string,
  tradeId: string,
  status: TradeStatus
) => {
  const works = load();
  const w = works.find(x => x.id === workId);
  if (!w) return;

  const t = w.trades.find(x => x.id === tradeId);
  if (!t) return;

  t.status = status;
  save(works);
};

/* ================= ON-CHAIN SYNC ================= */

/**
 * Sync when blockchain tx SUCCESS
 * - dùng để disable double-buy
 * - hiển thị trạng thái UI
 */
export function syncTradeSuccess(
  workId: string,
  buyer: string,
  txHash: string
) {
  const works = load();
  const w = works.find(x => x.id === workId);
  if (!w) return;

  w.onchainTrades ||= [];

  // tránh ghi trùng tx
  if (w.onchainTrades.some(t => t.txHash === txHash)) {
    return;
  }

  w.onchainTrades.push({
    buyer,
    txHash,
    time: Date.now(),
  });

  save(works);
}

/**
 * Check wallet đã mua tác phẩm này chưa
 * (dùng cho Trade page)
 */
export function hasBoughtWork(
  work: Work,
  walletAddress: string
) {
  return work.onchainTrades?.some(
    t => t.buyer.toLowerCase() === walletAddress.toLowerCase()
  );
}

/* ================= MULTI ADMIN APPROVAL ================= */

/**
 * ADMIN APPROVE (CÓ WEIGHT)
 */
export function approveWork(workId: string, adminWeight = 1) {
  const works = load();
  const admin = getCurrentUser();
  if (!admin) return;

  const w = works.find(x => x.id === workId);
  if (!w || w.status !== "pending") return;

  w.approvalMap ||= {};
  w.rejectionBy ||= [];
  w.quorumWeight ||= 3;

  if (w.rejectionBy.includes(admin.email)) return;
  if (w.approvalMap[admin.email]) return;

  w.approvalMap[admin.email] = adminWeight;

  const totalWeight = Object.values(w.approvalMap)
    .reduce((a, b) => a + b, 0);

  if (totalWeight >= w.quorumWeight) {
    w.status = "verified";
  }

  const wallet = getActiveAdminWallet(admin.email);

  addReviewLog({
    id: crypto.randomUUID(),
    workId,
    workTitle: w.title,
    adminEmail: admin.email,
    adminWallet: wallet?.address || "N/A",
    action: "approved",
    time: new Date().toISOString(),
  });

  save(works);
}

/**
 * ADMIN REJECT (1 PHIẾU LÀ ĐỦ)
 */
export function rejectWork(workId: string) {
  const works = load();
  const admin = getCurrentUser();
  if (!admin) return;

  const w = works.find(x => x.id === workId);
  if (!w || w.status !== "pending") return;

  w.rejectionBy ||= [];

  if (w.rejectionBy.includes(admin.email)) return;

  w.rejectionBy.push(admin.email);
  w.status = "rejected";

  const wallet = getActiveAdminWallet(admin.email);

  addReviewLog({
    id: crypto.randomUUID(),
    workId,
    workTitle: w.title,
    adminEmail: admin.email,
    adminWallet: wallet?.address || "N/A",
    action: "rejected",
    time: new Date().toISOString(),
  });

  save(works);
}

/**
 * UNDO / RESET REVIEW
 */
export function undoReview(workId: string) {
  const works = load();
  const w = works.find(x => x.id === workId);
  if (!w) return;

  w.status = "pending";
  w.approvalMap = {};
  w.rejectionBy = [];

  save(works);
}
