"use client";

import { useEffect, useState } from "react";
import {
  getPendingWorks,
  approveWork,
  rejectWork,
  type Work,
} from "@/lib/workStore";
import { useAuth } from "@/context/AuthContext";
import ReviewModal from "@/components/admin/logs/ReviewModal";
import styles from "@/styles/admin/reviewTable.module.css";

export default function ReviewTable() {
  const { user } = useAuth();

  /* ===== STATE ===== */
  const [works, setWorks] = useState<Work[]>([]);
  const [selected, setSelected] = useState<Work | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  /* ===== LOAD ===== */
  useEffect(() => {
    setWorks(getPendingWorks());
  }, []);

  /* ===== AUTH GUARD ===== */
  if (!user) return null;

  const walletConnected = !!user.wallet;

  /* ===== ACTIONS ===== */
  async function handleApprove(workId: string) {
    if (!user) return;
    if (!walletConnected || processingId) return;

    setProcessingId(workId);

    try {
      await approveWork({
        workId,
        reviewerId: user.id,
        reviewerRole: user.role, // ✅ approve cần role
        weight: 1,
      });

      setWorks(getPendingWorks());
    } catch (e) {
      console.error(e);
      alert("Cannot approve work");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(workId: string) {
    if (!user) return;
    if (!walletConnected || processingId) return;

    setProcessingId(workId);

    try {
      await rejectWork({
        workId,
        reviewerId: user.id,
        reason: "Không đạt yêu cầu", // ✅ KHÔNG truyền reviewerRole
      });

      setWorks(getPendingWorks());
    } catch (e) {
      console.error(e);
      alert("Cannot reject work");
    } finally {
      setProcessingId(null);
    }
  }

  /* ===== RENDER ===== */
  return (
    <>
      <table className={styles.table}>
        <tbody>
          {works.map((w) => (
            <tr key={w.id} className={styles.row}>
              <td className={styles.cell}>
                <strong>{w.title}</strong>
                <span className={styles.badge}>PENDING</span>
              </td>

              <td className={styles.cell}>
                <button
                  className={styles.detail}
                  disabled={!!processingId}
                  onClick={() => setSelected(w)}
                >
                  Xem chi tiết
                </button>
              </td>

              <td className={styles.cell}>
                <div className={styles.actions}>
                  <button
                    className={styles.approve}
                    disabled={
                      !walletConnected || processingId === w.id
                    }
                    onClick={() => handleApprove(w.id)}
                  >
                    {processingId === w.id
                      ? "Processing..."
                      : "Approve"}
                  </button>

                  <button
                    className={styles.reject}
                    disabled={
                      !walletConnected || processingId === w.id
                    }
                    onClick={() => handleReject(w.id)}
                  >
                    {processingId === w.id
                      ? "Processing..."
                      : "Reject"}
                  </button>
                </div>
              </td>
            </tr>
          ))}

          {works.length === 0 && (
            <tr>
              <td colSpan={3} className={styles.empty}>
                No works pending review
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {selected && (
        <ReviewModal
          work={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
