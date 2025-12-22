"use client";

import styles from "@/styles/admin/modal.module.css";

export default function DrillModal({
  title,
  items,
  onClose,
}: {
  title: string;
  items: string[];
  onClose: () => void;
}) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={e => e.stopPropagation()}
      >
        <h3>{title}</h3>
        <ul>
          {items.map((i, idx) => (
            <li key={idx}>{i}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
