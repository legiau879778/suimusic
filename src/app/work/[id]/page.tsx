"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import { getWorks, Work } from "@/lib/workStore";
import styles from "@/styles/work.module.css";

export default function WorkDetailPage() {
  const { id } = useParams<{ id: string }>();

  const work: Work | undefined = useMemo(() => {
    return getWorks().find(w => w.id === id);
  }, [id]);

  if (!work) {
    return (
      <p style={{ padding: 40 }}>
        Không tìm thấy tác phẩm
      </p>
    );
  }

  /* ===================== */
  /* REVIEW LOG (HIỂN THỊ) */
  /* ===================== */
  const reviewLogs = useMemo(() => {
    if (work.reviews && work.reviews.length > 0) {
      return work.reviews.map(r => ({
        admin: r.admin,
        action: r.action,
        time: new Date(r.time).toLocaleString(),
        reason: r.reason,
      }));
    }

    // fallback nếu chưa có review log
    if (work.status === "verified" || work.status === "rejected") {
      return [
        {
          admin: "admin@chainstorm.io",
          action:
            work.status === "verified"
              ? "approved"
              : "rejected",
          time: work.verifiedAt
            ? new Date(work.verifiedAt).toLocaleString()
            : work.rejectedAt
            ? new Date(work.rejectedAt).toLocaleString()
            : "—",
          reason: undefined,
        },
      ];
    }

    return [];
  }, [work]);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{work.title}</h1>

        <p className={styles.meta}>
          <strong>Trạng thái:</strong>{" "}
          {work.status}
        </p>

        {work.hash && (
          <p className={styles.hash}>
            <strong>SHA-256:</strong> {work.hash}
          </p>
        )}

        <hr className={styles.divider} />

        <h2>Lịch sử duyệt</h2>

        {reviewLogs.length === 0 && (
          <p className={styles.empty}>
            Chưa có lịch sử duyệt
          </p>
        )}

        <ul className={styles.timeline}>
          {reviewLogs.map((log, i) => (
            <li key={i} className={styles.logItem}>
              <div>
                <strong>{log.admin}</strong>{" "}
                {log.action === "approved"
                  ? "đã duyệt"
                  : "đã từ chối"}
              </div>

              <div className={styles.time}>
                {log.time}
              </div>

              {log.reason && (
                <div className={styles.reason}>
                  Lý do: {log.reason}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
