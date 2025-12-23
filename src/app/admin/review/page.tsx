"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import {
  getPendingWorks,
  approveWork,
  rejectWork,
  type Work,
} from "@/lib/workStore";
import { useAuth } from "@/context/AuthContext";
import styles from "@/styles/admin/adminReview.module.css";

export default function AdminReviewPage() {
  const { user } = useAuth();

  const [works, setWorks] = useState<Work[]>([]);
  const [selected, setSelected] =
    useState<Work | null>(null);
  const [reason, setReason] = useState("");
  const [processing, setProcessing] =
    useState(false);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    setWorks(getPendingWorks());
  }

  if (!user) return null;

  return (
    <AdminGuard>
      <main className={styles.page}>
        <h1>Duyệt tác phẩm</h1>

        {/* ===== TABLE ===== */}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tác phẩm</th>
              <th>Tác giả</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {works.map(w => (
              <tr key={w.id}>
                <td>
                  <strong>{w.title}</strong>
                </td>

                <td>{w.authorId}</td>

                <td className={styles.pending}>
                  Pending
                </td>

                <td>
                  <button
                    className={styles.reviewBtn}
                    disabled={
                      !!selected || processing
                    }
                    onClick={() => setSelected(w)}
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}

            {works.length === 0 && (
              <tr>
                <td colSpan={4}>
                  Không có tác phẩm chờ duyệt
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ===== REVIEW PANEL ===== */}
        {selected && (
          <div className={styles.overlay}>
            <div className={styles.panel}>
              <h2>{selected.title}</h2>

              <div className={styles.meta}>
                <strong>Tác giả:</strong>{" "}
                {selected.authorId}
              </div>

              <div className={styles.meta}>
                <strong>Hash:</strong>{" "}
                {selected.hash || "—"}
              </div>

              <textarea
                placeholder="Nhập lý do từ chối (bắt buộc nếu reject)"
                value={reason}
                onChange={e =>
                  setReason(e.target.value)
                }
                disabled={processing}
              />

              <div className={styles.actions}>
                <button
                  className={styles.approve}
                  disabled={processing}
                  onClick={async () => {
                    if (processing) return;
                    setProcessing(true);

                    await approveWork({
                      workId: selected.id,
                      admin: {
                        email: user.email!,
                        role: user.role,
                      },
                    });

                    setProcessing(false);
                    setSelected(null);
                    setReason("");
                    refresh();
                  }}
                >
                  {processing
                    ? "Đang xử lý..."
                    : "Approve"}
                </button>

                <button
                  className={styles.reject}
                  disabled={
                    processing ||
                    !reason.trim()
                  }
                  onClick={async () => {
                    if (processing) return;
                    setProcessing(true);

                    await rejectWork({
                      workId: selected.id,
                      admin: {
                        email: user.email!,
                        role: user.role,
                      },
                      reason: reason.trim(),
                    });

                    setProcessing(false);
                    setSelected(null);
                    setReason("");
                    refresh();
                  }}
                >
                  {processing
                    ? "Đang xử lý..."
                    : "Reject"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </AdminGuard>
  );
}
