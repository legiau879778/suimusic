"use client";

import styles from "./workReviewTimeline.module.css";
import { ReviewItem } from "@/lib/workStore";

export default function WorkReviewTimeline({
  reviews,
}: {
  reviews: ReviewItem[];
}) {
  if (!reviews.length)
    return <p className={styles.empty}>Chưa có lịch sử duyệt</p>;

  return (
    <div className={styles.timeline}>
      {reviews.map((r, i) => (
        <div key={i} className={styles.item}>
          <div
            className={`${styles.dot} ${
              r.action === "approved"
                ? styles.approved
                : styles.rejected
            }`}
          />

          <div className={styles.content}>
            <div className={styles.header}>
              <strong>{r.admin}</strong>
              <span
                className={
                  r.action === "approved"
                    ? styles.approvedText
                    : styles.rejectedText
                }
              >
                {r.action === "approved"
                  ? "Đã duyệt"
                  : "Từ chối"}
              </span>
            </div>

            <div className={styles.time}>
              {new Date(r.time).toLocaleString()}
            </div>

            {r.reason && (
              <div className={styles.reason}>
                Lý do: {r.reason}
              </div>
            )}

            {r.proof && (
              <div className={styles.proof}>
                Proof: {r.proof}
              </div>
            )}

            {r.signature && (
              <div className={styles.signature}>
                Signature: {r.signature.slice(0, 16)}…
              </div>
            )}

            {r.txHash && (
              <div className={styles.tx}>
                TxHash: {r.txHash.slice(0, 16)}…
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
