"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { getWorks, Work } from "@/lib/workStore";
import styles from "@/styles/manage.module.css";

export default function ManagePage() {
  const { user } = useAuth();

  const works = useMemo(() => {
    if (!user) return [];
    return getWorks().filter(w => w.authorId === user.id);
  }, [user]);

  if (!user) {
    return <p className={styles.empty}>Vui lòng đăng nhập</p>;
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Tác phẩm đã đăng ký</h1>

      {works.length === 0 && (
        <p className={styles.empty}>Chưa có tác phẩm</p>
      )}

      <div className={styles.list}>
        {works.map(w => (
          <div key={w.id} className={styles.card}>
            <div className={styles.header}>
              <h3>{w.title}</h3>

              <div className={styles.badges}>
                <span className={`${styles.badge} ${styles[w.status]}`}>
                  {w.status}
                </span>

                <span
                  className={`${styles.badge} ${styles[w.marketStatus]}`}
                >
                  {w.marketStatus}
                </span>
              </div>
            </div>

            <div className={styles.meta}>
              <span>🎵 Thể loại: {w.genre}</span>
              <span>🌐 Ngôn ngữ: {w.language}</span>
            </div>

            <div className={styles.meta}>
              <span>⏱ {Math.floor(w.duration / 60)} phút</span>
              <span>📅 {w.completedDate}</span>
            </div>

            <div className={styles.hash}>
              🔐 {w.fileHash.slice(0, 16)}…
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
