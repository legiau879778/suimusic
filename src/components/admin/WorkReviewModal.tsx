"use client";

import { useState } from "react";
import styles from "@/components/admin/workReviewModal.module.css";
import { approveWork, rejectWork } from "@/lib/workStore";
import { useAuth } from "@/context/AuthContext";

export default function WorkPreviewModal({
  work,
  onClose,
}: {
  work: any;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [proof, setProof] = useState("");

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{work.title}</h2>

        <div className={styles.meta}>
          <div><b>Tác giả:</b> {work.authorId}</div>
          <div><b>Market:</b> {work.marketStatus}</div>
          <div><b>Hash:</b></div>
          <code>{work.fileHash}</code>
        </div>

        {/* PROOF */}
        <label className={styles.label}>
          Proof duyệt (hash / URL)
        </label>
        <input
          className={styles.input}
          value={proof}
          onChange={(e) => setProof(e.target.value)}
          placeholder="IPFS hash / tx hash / URL"
        />

        {/* REJECT REASON */}
        <label className={styles.label}>
          Lý do từ chối
        </label>
        <textarea
          className={styles.textarea}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Nhập lý do từ chối…"
        />

        <div className={styles.actions}>
          <button
            className={styles.approve}
            onClick={async () => {
              await approveWork(work.id, proof);
              onClose();
            }}
          >
            Duyệt
          </button>

          <button
            className={styles.reject}
            disabled={!reason.trim()}
            onClick={() => {
              rejectWork(work.id, user!.email, reason);
              onClose();
            }}
          >
            Từ chối
          </button>
        </div>
      </div>
    </div>
  );
}
