// src/lib/reviewLogStore.ts
import { safeLoad, safeSave } from "./storage";

/* ================= STORAGE ================= */

const STORAGE_KEY = "chainstorm_review_logs";

/** ✅ realtime event */
export const REVIEW_LOGS_UPDATED_EVENT = "chainstorm_review_logs_updated";

/* ================= TYPES ================= */

export type ReviewAction =
  | "approved"
  | "approval_added" // ✅ NEW (bạn đang dùng trong approveWork)
  | "rejected"
  | "deleted"
  | "restored";

export type ReviewLogMeta = {
  reviewerId?: string;
  weight?: number;
  totalWeight?: number;
  quorumWeight?: number;
  reason?: string;
};

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

  /** ✅ NEW: extra payload */
  meta?: ReviewLogMeta;
};

/* ================= INTERNAL ================= */

function emitUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(REVIEW_LOGS_UPDATED_EVENT));
}

function load(): ReviewLog[] {
  return safeLoad<ReviewLog[]>(STORAGE_KEY) || [];
}

function save(data: ReviewLog[]) {
  safeSave(STORAGE_KEY, data);
  emitUpdated();
}

/* ================= GETTERS ================= */

export function getReviewLogs(): ReviewLog[] {
  return load();
}

export function getReviewLogsByWork(workId: string): ReviewLog[] {
  return load().filter((l) => l.workId === workId);
}

/* ================= MUTATION ================= */

export function addReviewLog(log: ReviewLog) {
  const logs = load();
  logs.unshift(log);
  save(logs);
}

/* ================= REALTIME SUBSCRIBE ================= */

/**
 * ✅ realtime logs:
 * - same-tab: REVIEW_LOGS_UPDATED_EVENT
 * - cross-tab: storage (khi safeSave setItem)
 */
export function subscribeReviewLogs(cb: () => void) {
  if (typeof window === "undefined") return () => {};

  const onEvent = () => cb();

  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };

  window.addEventListener(REVIEW_LOGS_UPDATED_EVENT, onEvent);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(REVIEW_LOGS_UPDATED_EVENT, onEvent);
    window.removeEventListener("storage", onStorage);
  };
}
