"use client";

import { Work } from "@/lib/workStore";
import styles from "@/styles/admin/review.module.css";

export default function ReviewModal({
  work,
  onClose,
}: {
  work: Work;
  onClose: () => void;
}) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>{work.title}</h2>

        <p><b>Hash:</b> {work.hash}</p>

        <input placeholder="Tx hash / Proof" />
        <textarea placeholder="Lý do từ chối" />

        <div className={styles.actions}>
          <button className={styles.approve}>
            Approve
          </button>
          <button className={styles.reject}>
            Reject
          </button>
          <button onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
