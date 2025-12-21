export type ReviewAction = "approved" | "rejected";

export type ReviewLog = {
  id: string;
  workId: string;
  workTitle: string;
  adminEmail: string;
  adminWallet?: string;
  action: ReviewAction;
  time: string;
};

const KEY = "CHAINSTORM_REVIEW_LOG";

export function getReviewLogs(): ReviewLog[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(KEY) || "[]");
}

function saveAll(logs: ReviewLog[]) {
  localStorage.setItem(KEY, JSON.stringify(logs));
}

export function addReviewLog(log: ReviewLog) {
  saveAll([log, ...getReviewLogs()]);
}

export function exportLogsCSV() {
  const header =
    "WorkID,Title,AdminEmail,AdminWallet,Action,Time\n";

  const rows = getReviewLogs()
    .map(
      l =>
        `${l.workId},"${l.workTitle}",${l.adminEmail},${l.adminWallet || ""},${l.action},${l.time}`
    )
    .join("\n");

  return header + rows;
}
