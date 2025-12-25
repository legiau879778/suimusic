"use client";

import styles from "@/styles/admin/review-log-table.module.css";
import type { ReviewLog } from "@/lib/reviewLogStore";

import {
  CheckCircle,
  XCircle,
  Trash,
  ArrowCounterClockwise,
  PlusCircle,
  Clock,
  UserCircle,
} from "@phosphor-icons/react";

export default function ReviewLogTable({ logs }: { logs: ReviewLog[] }) {
  if (!logs || logs.length === 0) {
    return (
      <div className={styles.empty}>
        <Clock size={34} weight="duotone" />
        <div className={styles.emptyTitle}>Chưa có lịch sử duyệt</div>
        <div className={styles.emptySub}>Khi admin duyệt/từ chối, log sẽ hiển thị tại đây.</div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Lịch sử duyệt</h3>
          <div className={styles.sub}>Realtime theo localStorage / event</div>
        </div>

        <div className={styles.count}>
          {logs.length} bản ghi
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tác phẩm</th>
              <th>Hành động</th>
              <th>Admin</th>
              <th>Thời gian</th>
              <th>Lý do</th>
            </tr>
          </thead>

          <tbody>
            {logs.map((log) => {
              const { label, tone, icon } = renderAction(log.action);
              const timeText = formatTime(log.time);

              return (
                <tr key={log.id} className={styles.row}>
                  <td className={styles.workCell}>
                    <div className={styles.workTitle}>{log.workTitle || "Untitled"}</div>
                    <div className={styles.workId}>#{shortId(log.workId)}</div>
                  </td>

                  <td>
                    <span className={`${styles.badge} ${badgeToneClass(tone, styles)}`}>
                      <span className={styles.badgeIcon} aria-hidden="true">
                        {icon}
                      </span>
                      {label}
                    </span>
                  </td>

                  <td className={styles.adminCell}>
                    <span className={styles.adminIcon} aria-hidden="true">
                      <UserCircle size={16} weight="duotone" />
                    </span>
                    <span className={styles.adminText}>{log.adminEmail || log.adminRole || "—"}</span>
                  </td>

                  <td className={styles.timeCell}>
                    <div className={styles.timeMain}>{timeText}</div>
                  </td>

                  <td className={styles.reasonCell}>
                    <span className={styles.reasonText}>
                      {log.reason || log.meta?.reason || "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= HELPERS ================= */

function shortId(id?: string) {
  const v = String(id || "");
  if (v.length <= 10) return v || "—";
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

function formatTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("vi-VN");
}

function renderAction(action: ReviewLog["action"]) {
  switch (action) {
    case "approved":
      return {
        label: "Approved",
        tone: "ok" as const,
        icon: <CheckCircle size={14} weight="fill" />,
      };
    case "approval_added":
      return {
        label: "Approval +",
        tone: "info" as const,
        icon: <PlusCircle size={14} weight="fill" />,
      };
    case "rejected":
      return {
        label: "Rejected",
        tone: "bad" as const,
        icon: <XCircle size={14} weight="fill" />,
      };
    case "deleted":
      return {
        label: "Deleted",
        tone: "muted" as const,
        icon: <Trash size={14} weight="fill" />,
      };
    case "restored":
      return {
        label: "Restored",
        tone: "info" as const,
        icon: <ArrowCounterClockwise size={14} weight="fill" />,
      };
    default:
      return {
        label: String(action || "Unknown"),
        tone: "muted" as const,
        icon: <Clock size={14} weight="fill" />,
      };
  }
}

function badgeToneClass(
  tone: "ok" | "bad" | "info" | "muted",
  styles: Record<string, string>
) {
  if (tone === "ok") return styles.badgeOk;
  if (tone === "bad") return styles.badgeBad;
  if (tone === "info") return styles.badgeInfo;
  return styles.badgeMuted;
}
