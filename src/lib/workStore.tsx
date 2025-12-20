// src/lib/workStore.ts
export type TradeStatus = "pending" | "accepted" | "rejected";

export type Trade = {
  id: string;
  buyer: string;
  date: string;
  status: TradeStatus;
};
export type MarketStatus = "private" | "public" | "tradeable";
export type WorkStatus = "pending" | "verified" | "rejected";

const STORAGE_KEY = "works";


export type Work = {
  id: string;
  title: string;
  authorId: string;

  genre: string;
  language: string;
  completedDate: string;

  marketStatus: MarketStatus; // ✅ camelCase

  duration: number;
  fileHash: string;
  status: WorkStatus;
  createdAt: number;
  trades: Trade[];
};

export const addWork = (data: {
  title: string;
  authorId: string;
  genre: string;
  language: string;
  completedDate: string;
  marketStatus: MarketStatus; // ✅ camelCase
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
  });

  save(works);
};


/* ================= STORAGE ================= */

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


export const verifyWork = (
  workId: string,
  status: "verified" | "rejected"
) => {
  const works = load();
  const w = works.find(x => x.id === workId);
  if (!w) return;

  w.status = status;
  save(works);
};

/* ================= TRADE ================= */

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

export const countWorksByAuthor = (authorId: string) =>
  load().filter(w => w.authorId === authorId).length;
