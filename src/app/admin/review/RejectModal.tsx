"use client";

import { useState } from "react";
import styles from "@/styles/admin/rejectModal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

export default function RejectModal({
  open,
  onClose,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState("");

  if (!open) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>Từ chối tác phẩm</h2>

        <textarea
          placeholder="Nhập lý do từ chối..."
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={4}
        />

        <div className={styles.actions}>
          <button
            className={styles.cancel}
            onClick={onClose}
          >
            Huỷ
          </button>

          <button
            className={styles.reject}
            disabled={!reason.trim()}
            onClick={() => {
              onConfirm(reason.trim());
              setReason("");
            }}
          >
            Xác nhận từ chối
          </button>
        </div>
      </div>
    </div>
  );
}
