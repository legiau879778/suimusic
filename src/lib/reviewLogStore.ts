export type ReviewLog = {
  id: string;
  workId: string;
  workTitle: string;
  adminEmail: string;
  adminRole: string;
  action: "approved" | "rejected";
  reason?: string;
  time: string;
};

const KEY = "chainstorm_review_logs";

function load(): ReviewLog[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(KEY) || "[]");
}

function save(data: ReviewLog[]) {
  localStorage.setItem(KEY, JSON.stringify(data));
  window.dispatchEvent(new Event("review-log-updated"));
}

export function getReviewLogs(): ReviewLog[] {
  return load();
}

export function addReviewLog(log: ReviewLog) {
  const logs = load();
  logs.unshift(log);
  save(logs);
}
