export type AuthorReviewLog = {
  id: string;
  authorId: string;
  action: "approved" | "rejected";
  adminEmail: string;
  signature?: string;
  time: string;
};

const KEY = "author_review_logs";

function load(): AuthorReviewLog[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(KEY) || "[]");
}

function save(data: AuthorReviewLog[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getAuthorReviewLogs(authorId: string) {
  return load().filter(l => l.authorId === authorId);
}

export function addAuthorReviewLog(log: AuthorReviewLog) {
  const logs = load();
  logs.push(log);
  save(logs);
}
