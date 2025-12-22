// src/lib/reviewLogStore.ts
import type { UserRole } from "@/context/AuthContext";

export type ReviewLog = {
  id: string;
  workId: string;
  workTitle: string;

  action: "approved" | "rejected";

  adminEmail: string;
  adminRole: UserRole;

  time: string;
};

const KEY = "chainstorm_review_logs";

export function getReviewLogs(): ReviewLog[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function addReviewLog(log: ReviewLog) {
  if (typeof window === "undefined") return;

  const logs = getReviewLogs();
  logs.unshift(log);
  localStorage.setItem(KEY, JSON.stringify(logs));
}
