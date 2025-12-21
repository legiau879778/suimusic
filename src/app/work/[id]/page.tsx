"use client";

import { useParams } from "next/navigation";
import { getWorks } from "@/lib/workStore";
import styles from "@/styles/workDetail.module.css";

export default function WorkDetailPage() {
  const { id } = useParams();
  const work = getWorks().find((w) => w.id === id);

  if (!work) {
    return <div style={{ padding: 40 }}>Không tìm thấy tác phẩm</div>;
  }

  return (
    <div className={styles.page}>
      <h1>{work.title}</h1>

      <div className={styles.meta}>
        <span>Tác giả: {work.authorName}</span>
        <span>Hash: {work.hash}</span>
      </div>

      <div className={styles.status}>
        Trạng thái:{" "}
        <strong
          className={
            work.status === "approved"
              ? styles.approved
              : work.status === "rejected"
              ? styles.rejected
              : styles.pending
          }
        >
          {work.status}
        </strong>
      </div>

      {/* ===== REVIEW INFO ===== */}
      {work.status !== "pending" && (
        <div className={styles.reviewInfo}>
          <span>
            {work.status === "approved" ? "✔ Đã duyệt" : "✖ Bị từ chối"}
          </span>
          <span>
            bởi <strong>{work.reviewedBy}</strong>
          </span>
          <span>
            lúc{" "}
            {work.reviewedAt
              ? new Date(work.reviewedAt).toLocaleString()
              : ""}
          </span>
        </div>
      )}
    </div>
  );
}
