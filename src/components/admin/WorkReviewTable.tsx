"use client";

import styles from "@/styles/admin/reviewTable.module.css";
import { Work, approveWork, rejectWork } from "@/lib/workStore";
import { useAuth } from "@/context/AuthContext";

type Props = {
  works: Work[];
  onOpenReview: (work: Work) => void;
};

export default function WorkReviewTable({
  works,
  onOpenReview,
}: Props) {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Tiêu đề</th>
          <th>Tác giả</th>
          <th>Trạng thái</th>
          <th>Quorum</th>
          <th>Hành động</th>
        </tr>
      </thead>

      <tbody>
        {works.map(w => (
          <tr key={w.id}>
            <td>{w.title}</td>
            <td>{w.authorId}</td>
            <td>{w.status}</td>
            <td>
              {Object.values(w.approvalMap).reduce(
                (a, b) => a + b,
                0
              )}
              {" / "}
              {w.quorumWeight}
            </td>

            <td className={styles.actions}>
              {/* ===== APPROVE (mở modal) ===== */}
              <button
                onClick={() => onOpenReview(w)}
              >
                Review
              </button>

              {/* ===== QUICK REJECT ===== */}
              <button
                className={styles.reject}
                onClick={() =>
                  rejectWork({
                    workId: w.id,
                    admin: {
                      email: user.email,
                      role: user.role,
                    },
                    reason: "Rejected",
                  })
                }
              >
                Reject
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
