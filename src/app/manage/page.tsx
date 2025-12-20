"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { getWorks, Work } from "@/lib/workStore";
import styles from "@/styles/manage.module.css";

const statusText = (s: Work["status"]) => {
  switch (s) {
    case "pending":
      return "⏳ Chờ duyệt";
    case "verified":
      return "✅ Đã xác thực";
    case "rejected":
      return "❌ Bị từ chối";
  }
};

export default function ManagePage() {
  const { user } = useAuth();

  if (!user) {
    return <p className={styles.empty}>Vui lòng đăng nhập</p>;
  }

  const works = useMemo(
    () => getWorks().filter(w => w.authorId === user.id),
    [user.id]
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Tác phẩm đã đăng ký</h1>

      {works.length === 0 && (
        <p className={styles.empty}>Chưa có tác phẩm nào</p>
      )}

      <div className={styles.list}>
        {works.map(w => (
          <div key={w.id} className={styles.card}>
            <div className={styles.header}>
              <h3>{w.title}</h3>
              <span
                className={`${styles.status} ${styles[w.status]}`}
              >
                {statusText(w.status)}
              </span>
            </div>

            <div className={styles.meta}>
              <span>⏱ {Math.floor(w.duration / 60)} phút</span>
              <span>🔐 {w.fileHash.slice(0, 12)}…</span>
            </div>

            <div className={styles.trade}>
              📜 Giao dịch bản quyền:{" "}
              <b>{w.trades.length}</b>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
