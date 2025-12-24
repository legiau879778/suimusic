"use client";

import { useState } from "react";
import styles from "./manage.module.css";

export default function SellNFTModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (buyer: string, price: bigint) => void;
}) {
  const [buyer, setBuyer] = useState("");
  const [price, setPrice] = useState("1");

  if (!open) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3>Bán NFT</h3>

        <input
          placeholder="Ví người mua"
          value={buyer}
          onChange={e => setBuyer(e.target.value)}
        />

        <input
          type="number"
          value={price}
          onChange={e => setPrice(e.target.value)}
        />

        <div className={styles.modalActions}>
          <button onClick={onClose}>Huỷ</button>
          <button
            className={styles.primary}
            onClick={() =>
              onConfirm(
                buyer,
                BigInt(
                  Number(price) * 1_000_000_000
                )
              )
            }
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}
