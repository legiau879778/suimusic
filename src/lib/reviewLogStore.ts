import { safeLoad, safeSave } from "./storage";

/* ================= STORAGE ================= */

const STORAGE_KEY = "chainstorm_review_logs";

/* ================= TYPES ================= */

export type ReviewAction =
  | "approved"
  | "rejected"
  | "deleted"
  | "restored";

export type ReviewLog = {
  id: string;
  workId: string;
  workTitle: string;

  action: ReviewAction;

  /** admin nếu có */
  adminEmail?: string;
  adminRole: string;

  time: string;

  reason?: string;
};

/* ================= INTERNAL ================= */

function load(): ReviewLog[] {
  return safeLoad<ReviewLog[]>(STORAGE_KEY) || [];
}

function save(data: ReviewLog[]) {
  safeSave(STORAGE_KEY, data);
}

/* ================= GETTERS ================= */

export function getReviewLogs(): ReviewLog[] {
  return load();
}

export function getReviewLogsByWork(
  workId: string
): ReviewLog[] {
  return load().filter(l => l.workId === workId);
}

/* ================= MUTATION ================= */

export function addReviewLog(log: ReviewLog) {
  const logs = load();
  logs.unshift(log);
  save(logs);
}
