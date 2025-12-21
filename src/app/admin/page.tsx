"use client";

import styles from "@/styles/admin.module.css";
import { useEffect, useState } from "react";
import {
  getWorks,
  approveWork,
  rejectWork,
  undoReview,
} from "@/lib/workStore";
import {
  getReviewLogs,
  exportLogsCSV,
} from "@/lib/reviewLogStore";
import { getCurrentUser } from "@/lib/authStore";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
  const user = getCurrentUser();

  const [works, setWorks] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.push("/");
      return;
    }
    setWorks(getWorks());
    setLogs(getReviewLogs());
  }, []);

  const refresh = () => {
    setWorks(getWorks());
    setLogs(getReviewLogs());
  };

  return (
    <div className={styles.page}>
      <h1>Admin – Multi-Admin Approval</h1>

      {/* ===== WORKS ===== */}
      <div className={styles.grid}>
        {works.map((w) => (
          <div key={w.id} className={styles.card}>
            <h3>{w.title}</h3>

            <p>
              Duyệt:{" "}
              {(w.approvals?.length || 0)} /{" "}
              {w.quorum || 2}
            </p>

            <p>Trạng thái: {w.status}</p>

            {w.status === "pending" && (
              <div className={styles.actions}>
                <button
                  className={styles.approve}
                  onClick={() => {
                    approveWork(w.id);
                    refresh();
                  }}
                >
                  ✔ Approve
                </button>

                <button
                  className={styles.reject}
                  onClick={() => {
                    rejectWork(w.id);
                    refresh();
                  }}
                >
                  ✖ Reject
                </button>
              </div>
            )}

            {w.status !== "pending" && (
              <button
                className={styles.undo}
                onClick={() => {
                  undoReview(w.id);
                  refresh();
                }}
              >
                ↩ Undo
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ===== LOG ===== */}
      <section className={styles.logSection}>
        <h2>Lịch sử duyệt</h2>
        <button onClick={exportLogsCSV}>
          ⬇ Export CSV
        </button>

        <ul className={styles.log}>
          {logs.map((l) => (
            <li key={l.id}>
              <strong>{l.workTitle}</strong> – {l.action}
              <br />
              {l.adminEmail}
              <span>
                {new Date(l.time).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
