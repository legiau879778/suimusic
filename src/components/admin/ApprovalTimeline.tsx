"use client";

import styles from "@/styles/admin/timeline.module.css";

export default function ApprovalTimeline({
  reviews,
}: {
  reviews: any[];
}) {
  if (!reviews || reviews.length === 0) {
    return <em>Chưa có hành động duyệt</em>;
  }

  return (
    <div className={styles.timeline}>
      {reviews.map((r, i) => (
        <div key={i} className={styles.item}>
          <div
            className={`${styles.dot} ${
              r.action === "approved"
                ? styles.approve
                : styles.reject
            }`}
          />

          <div className={styles.content}>
            <strong>{r.admin}</strong>
            <span>
              {r.action}
              {r.weight ? ` (+${r.weight})` : ""}
            </span>

            <small>
              {new Date(r.time).toLocaleString()}
            </small>

            {r.reason && <p>Lý do: {r.reason}</p>}
            {r.proof && <p>Proof: {r.proof}</p>}

            {r.signature && (
              <p>
                Signature:
                <code>{r.signature.slice(0, 24)}…</code>
              </p>
            )}

            {r.txHash && (
              <p>
                TxHash:
                <code>{r.txHash.slice(0, 24)}…</code>
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
