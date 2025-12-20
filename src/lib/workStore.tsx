/* ===================== TYPES ===================== */

export type TradeStatus = "pending" | "accepted" | "rejected";

export type Trade = {
  id: string;
  buyer: string;
  date: string;
  status: TradeStatus;
};

export type WorkStatus = "pending" | "verified" | "rejected";

export type Work = {
  id: string;
  title: string;
  authorId: string;
  duration: number;
  fileHash: string;
  status: WorkStatus;
  createdAt: number;
  trades: Trade[];
};

/* ===================== STORAGE ===================== */

const KEY = "works";

const load = (): Work[] => {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(KEY) || "[]");
};

const save = (data: Work[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(data));
};

/* ===================== WORK ===================== */

export const getWorks = (): Work[] => load();

export const addWork = (data: {
  title: string;
  authorId: string;
  duration: number;
  fileHash: string;
}) => {
  const works = load();

  works.push({
    id: crypto.randomUUID(),
    title: data.title,
    authorId: data.authorId,
    duration: data.duration,
    fileHash: data.fileHash,
    status: "pending",
    createdAt: Date.now(),
    trades: [],
  });

  save(works);
};

export const verifyWork = (
  workId: string,
  status: "verified" | "rejected"
) => {
  const works = load();
  const w = works.find(w => w.id === workId);
  if (!w) return;

  w.status = status;
  save(works);
};

export const countWorksByAuthor = (authorId: string): number => {
  return load().filter(w => w.authorId === authorId).length;
};

/* ===================== TRADE ===================== */

export const addTrade = (workId: string, buyer: string) => {
  const works = load();
  const w = works.find(w => w.id === workId);
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
  const w = works.find(w => w.id === workId);
  if (!w) return;

  const t = w.trades.find(t => t.id === tradeId);
  if (!t) return;

  t.status = status;
  save(works);
};
