"use client";

import styles from "@/styles/admin/reviewModal.module.css";

export default function ReviewModal({
  work,
  onClose,
}: {
  work: any;
  onClose: () => void;
}) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>{work.title}</h2>

        <div className={styles.meta}>
          <div><b>Author ID:</b> {work.authorId}</div>
          <div><b>Hash:</b> {work.hash || "—"}</div>
          <div><b>Status:</b> {work.status}</div>
        </div>

        <button className={styles.close} onClick={onClose}>
          Đóng
        </button>
      </div>
    </div>
  );
}
