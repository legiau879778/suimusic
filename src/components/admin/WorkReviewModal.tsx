"use client";

import { useState } from "react";
import styles from "@/styles/work.module.css";
import { approveWork, rejectWork, Work } from "@/lib/workStore";
import { useAuth } from "@/context/AuthContext";

type Props = {
  work: Work;
  onClose: () => void;
};

export default function WorkReviewModal({
  work,
  onClose,
}: Props) {
  const { user } = useAuth();
  const [proof, setProof] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>Duyệt tác phẩm</h2>

        {/* ===== APPROVE ===== */}
        <textarea
          placeholder="Proof / Tx hash (tuỳ chọn)"
          value={proof}
          onChange={e => setProof(e.target.value)}
        />

        <button
          className={styles.approve}
          disabled={loading}
          onClick={async () => {
            setLoading(true);

            await approveWork({
            workId: work.id,
            admin: {
              email: user.email,
              role: user.role,
            },
            adminWeight: 1,
            proof,
          });


            setLoading(false);
            onClose();
          }}
        >
          Duyệt
        </button>

        {/* ===== REJECT ===== */}
        <textarea
          placeholder="Lý do từ chối"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />

        <button
          className={styles.reject}
          disabled={!reason.trim() || loading}
          onClick={() => {
            rejectWork({
            workId: work.id,
            admin: {
              email: user.email,
              role: user.role,
            },
            reason,
          });
            onClose();
          }}
        >
          Từ chối
        </button>

        <button
          className={styles.close}
          onClick={onClose}
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
