"use client";

import { useState } from "react";
import type { Work } from "@/lib/workStore";
import styles from "@/styles/admin/reviewPanel.module.css";

export default function ReviewPanel({
  work,
  onClose,
}: {
  work: Work;
  onClose: () => void;
}) {
  const [txHash, setTxHash] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <h2>{work.title}</h2>

        {/* ===== META ===== */}
        <div className={styles.meta}>
          <div>
            <b>Author ID:</b> {work.authorId}
          </div>
          {work.hash && (
            <div>
              <b>Hash:</b> {work.hash}
            </div>
          )}
        </div>

        {/* ===== QUORUM ===== */}
        <div className={styles.quorum}>
          <h4>
            Quorum ({Object.keys(work.approvalMap).length}/
            {work.quorumWeight})
          </h4>

          {Object.keys(work.approvalMap).length === 0 && (
            <div className={styles.empty}>
              Chưa có admin duyệt
            </div>
          )}

          {Object.entries(work.approvalMap).map(
            ([wallet, weight]) => (
              <div key={wallet} className={styles.approval}>
                ✔ {wallet.slice(0, 6)}…
                <span className={styles.weight}>
                  +{weight}
                </span>
              </div>
            )
          )}
        </div>

        {/* ===== INPUTS ===== */}
        <input
          className={styles.input}
          placeholder="Tx hash / Proof (optional)"
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
        />

        <textarea
          className={styles.textarea}
          placeholder="Lý do từ chối (nếu Reject)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        {/* ===== ACTIONS ===== */}
        <div className={styles.actions}>
          <button className={styles.approve}>
            Approve
          </button>
          <button className={styles.reject}>
            Reject
          </button>
          <button
            className={styles.close}
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
