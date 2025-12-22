/* ======================================================
   EXPORT CSV UTILS
   ====================================================== */

export type CSVRow = Record<string, string | number | undefined>;

/* ================= CORE ================= */

function downloadCSV(filename: string, rows: CSVRow[]) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),

    ...rows.map(row =>
      headers
        .map(h => `"${String(row[h] ?? "").replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

/* ================= EXPORT REVIEW LOG ================= */

export function exportReviewCSV(
  logs: any[],
  filename = "review_logs.csv"
) {
  const rows = logs.map(l => ({
    time: l.time,
    workId: l.workId,
    workTitle: l.workTitle,
    adminEmail: l.adminEmail,
    adminWallet: l.adminWallet,
    action: l.action,
    reason: l.reason,
    txHash: l.txHash,
  }));

  downloadCSV(filename, rows);
}

/* ================= ALIASES (QUAN TRỌNG) ================= */

/**
 * Alias cho UI đang dùng
 */
export function exportCSV(
  logs: any[],
  filename?: string
) {
  exportReviewCSV(logs, filename);
}
