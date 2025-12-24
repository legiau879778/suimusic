"use client";

import { useState } from "react";
import styles from "./manage.module.css";

export default function LicenseModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (licensee: string, royalty: number) => void;
}) {
  const [licensee, setLicensee] = useState("");
  const [royalty, setRoyalty] = useState("10");

  if (!open) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3>Cấp License</h3>

        <input
          placeholder="Ví licensee"
          value={licensee}
          onChange={e =>
            setLicensee(e.target.value)
          }
        />

        <input
          type="number"
          min="0"
          max="100"
          value={royalty}
          onChange={e =>
            setRoyalty(e.target.value)
          }
        />

        <div className={styles.modalActions}>
          <button onClick={onClose}>Huỷ</button>
          <button
            className={styles.primary}
            onClick={() =>
              onConfirm(
                licensee,
                Number(royalty)
              )
            }
          >
            Cấp
          </button>
        </div>
      </div>
    </div>
  );
}
