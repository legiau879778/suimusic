"use client";

import { useEffect, useState } from "react";
import {
  getWorks,
  verifyWork,
  Work,
} from "@/lib/workStore";

import styles from "@/styles/admin.module.css";

export default function AdminPage() {
  const [works, setWorks] = useState<Work[]>([]);

  const reload = () => {
    setWorks(getWorks());
  };

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Admin – Duyệt tác phẩm</h1>

      <div className={styles.panel}>
        {works.length === 0 && (
          <p className={styles.empty}>Chưa có tác phẩm</p>
        )}

        {works.map(w => (
          <div key={w.id} className={styles.card}>
            <div>
              <b>{w.title}</b>
              <p>Author ID: {w.authorId}</p>
              <p>Hash: {w.fileHash}</p>
              <p>
                Trạng thái:{" "}
                <span className={styles[w.status]}>
                  {w.status}
                </span>
              </p>
            </div>

            {w.status === "pending" && (
              <div className={styles.actions}>
                <button
                  className={styles.approve}
                  onClick={() => {
                    verifyWork(w.id, "verified");
                    reload();
                  }}
                >
                  Duyệt
                </button>

                <button
                  className={styles.reject}
                  onClick={() => {
                    verifyWork(w.id, "rejected");
                    reload();
                  }}
                >
                  Từ chối
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
