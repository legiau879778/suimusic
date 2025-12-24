"use client";

import { useState } from "react";
import styles from "./marketplace.module.css";

export default function BuyLicenseModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (royalty: number) => void;
}) {
  const [royalty, setRoyalty] = useState("10");

  if (!open) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3>Mua License</h3>

        <input
          type="number"
          min="0"
          max="100"
          value={royalty}
          onChange={e =>
            setRoyalty(e.target.value)
          }
        />

        <div className={styles.actions}>
          <button onClick={onClose}>Huỷ</button>
          <button
            className={styles.primary}
            onClick={() =>
              onConfirm(Number(royalty))
            }
          >
            Mua
          </button>
        </div>
      </div>
    </div>
  );
}
