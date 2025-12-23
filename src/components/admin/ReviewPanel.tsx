"use client";

import { useState } from "react";
import type { Work } from "@/lib/workStore";
import styles from "@/styles/admin/reviewPanel.module.css";

/**
 * 🔐 RULE QUORUM (ANY2 / CÁCH 1)
 * Không lưu trong Work
 * Có thể đổi 2, 3, 5... sau
 */
const REQUIRED_QUORUM = 1;

export default function ReviewPanel({
  work,
  onClose,
}: {
  work: Work;
  onClose: () => void;
}) {
  const [txHash, setTxHash] = useState("");
  const [reason, setReason] = useState("");

  const approvedCount =
    Object.keys(work.approvalMap).length;

  const reachedQuorum =
    approvedCount >= REQUIRED_QUORUM;

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
            Quorum ({approvedCount}/
            {REQUIRED_QUORUM})
          </h4>

          {approvedCount === 0 && (
            <div className={styles.empty}>
              Chưa có admin duyệt
            </div>
          )}

          {Object.entries(work.approvalMap).map(
            ([wallet, weight]) => (
              <div
                key={wallet}
                className={styles.approval}
              >
                ✔ {wallet.slice(0, 6)}…
                <span className={styles.weight}>
                  +{weight}
                </span>
              </div>
            )
          )}

          {reachedQuorum && (
            <div className={styles.success}>
              ✅ Đã đạt quorum duyệt
            </div>
          )}
        </div>

        {/* ===== INPUTS ===== */}
        <input
          className={styles.input}
          placeholder="Tx hash / Proof (optional)"
          value={txHash}
          onChange={(e) =>
            setTxHash(e.target.value)
          }
        />

        <textarea
          className={styles.textarea}
          placeholder="Lý do từ chối (nếu Reject)"
          value={reason}
          onChange={(e) =>
            setReason(e.target.value)
          }
        />

        {/* ===== ACTIONS ===== */}
        <div className={styles.actions}>
          <button
            className={styles.approve}
            disabled={!reachedQuorum}
            title={
              reachedQuorum
                ? ""
                : "Chưa đủ quorum"
            }
          >
            Approve
          </button>

          <button
            className={styles.reject}
            disabled={!reason.trim()}
          >
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
