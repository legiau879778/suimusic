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

  const [pending, setPending] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [keyword, setKeyword] = useState("");
  const [action, setAction] = useState<
    "all" | "approved" | "rejected" | "undo"
  >("all");

  /* ===== AUTH + INIT ===== */
  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.push("/");
      return;
    }
    setPending(getWorks().filter((w) => w.status === "pending"));
  }, []);

  /* ===== REALTIME LOG (SERVER-SIDE SSE) ===== */
  useEffect(() => {
    const es = new EventSource("/api/admin/log-stream");
    es.onmessage = (e) => {
      setLogs(JSON.parse(e.data));
    };
    return () => es.close();
  }, []);

  /* ===== ACTIONS ===== */
  const approve = (id: string) => {
    approveWork(id);
    setPending((p) => p.filter((w) => w.id !== id));
  };

  const reject = (id: string) => {
    rejectWork(id);
    setPending((p) => p.filter((w) => w.id !== id));
  };

  const exportCSV = () => {
    const csv = exportLogsCSV();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "review-log.csv";
    a.click();
  };

  /* ===== FILTER ===== */
  const filteredLogs = logs.filter((l) => {
    const matchText =
      l.workTitle.toLowerCase().includes(keyword.toLowerCase()) ||
      l.adminEmail.toLowerCase().includes(keyword.toLowerCase());

    const matchAction =
      action === "all" ? true : l.action === action;

    return matchText && matchAction;
  });

  return (
    <div className={styles.page}>
      <h1>Admin – Duyệt tác phẩm</h1>

      {/* ===== PENDING ===== */}
      <section>
        <h2>Chờ duyệt</h2>

        <div className={styles.grid}>
          {pending.map((w) => (
            <div key={w.id} className={styles.card}>
              <h3>{w.title}</h3>
              <p>{w.authorName}</p>

              <div className={styles.actions}>
                <button
                  className={styles.approve}
                  onClick={() => approve(w.id)}
                >
                  ✔ Duyệt
                </button>
                <button
                  className={styles.reject}
                  onClick={() => reject(w.id)}
                >
                  ✖ Từ chối
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== LOG ===== */}
      <section className={styles.logSection}>
        <h2>Lịch sử duyệt</h2>

        <div className={styles.filters}>
          <input
            placeholder="Tìm tác phẩm / admin"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />

          <select
            value={action}
            onChange={(e) =>
              setAction(e.target.value as any)
            }
          >
            <option value="all">Tất cả</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Từ chối</option>
            <option value="undo">Undo</option>
          </select>

          <button onClick={exportCSV}>
            ⬇ Export CSV
          </button>
        </div>

        <ul className={styles.log}>
          {filteredLogs.map((l) => (
            <li key={l.id}>
              <strong>{l.workTitle}</strong> — {l.action} <br />
              bởi {l.adminEmail}
              <span>
                {new Date(l.time).toLocaleString()}
              </span>

              {l.action !== "undo" && (
                <button
                  className={styles.undo}
                  onClick={() => undoReview(l.workId)}
                >
                  ↩ Undo
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
