"use client";

import { useState } from "react";
import styles from "./marketplace.module.css";

export default function BuyNFTModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (price: bigint) => void;
}) {
  const [price, setPrice] = useState("1");

  if (!open) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3>Mua NFT</h3>

        <input
          type="number"
          value={price}
          onChange={e => setPrice(e.target.value)}
        />

        <div className={styles.actions}>
          <button onClick={onClose}>Huỷ</button>
          <button
            className={styles.primary}
            onClick={() =>
              onConfirm(
                BigInt(
                  Number(price) * 1_000_000_000
                )
              )
            }
          >
            Mua
          </button>
        </div>
      </div>
    </div>
  );
}
