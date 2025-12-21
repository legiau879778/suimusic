export type ReviewAction =
  | "approved"
  | "rejected"
  | "undo";

export type ReviewLog = {
  id: string;
  workId: string;
  workTitle: string;
  adminEmail: string;
  action: ReviewAction;
  time: string;
};

const KEY = "CHAINSTORM_REVIEW_LOG";

export function getReviewLogs(): ReviewLog[] {
  return JSON.parse(localStorage.getItem(KEY) || "[]");
}

function saveAll(logs: ReviewLog[]) {
  localStorage.setItem(KEY, JSON.stringify(logs));
}

export function addReviewLog(log: ReviewLog) {
  saveAll([log, ...getReviewLogs()]);
}

export function exportLogsCSV() {
  const header = "WorkID,Title,Admin,Action,Time\n";
  const rows = getReviewLogs()
    .map(
      (l) =>
        `${l.workId},"${l.workTitle}",${l.adminEmail},${l.action},${l.time}`
    )
    .join("\n");

  return header + rows;
}
