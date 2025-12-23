"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import {
  getPendingAuthors,
  approveAuthor,
  rejectAuthor,
  type Author,
} from "@/lib/authorStore";
import styles from "./authorAdmin.module.css";

export default function AdminAuthorPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [selected, setSelected] = useState<Author | null>(null);

  function load() {
    setAuthors(getPendingAuthors());
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AdminGuard>
      <main className={styles.page}>
        <header className={styles.header}>
          <h1>Duyệt tác giả</h1>
          <span className={styles.count}>
            Đang chờ: {authors.length}
          </span>
        </header>

        {authors.length === 0 ? (
          <p className={styles.empty}>
            Không có tác giả chờ duyệt
          </p>
        ) : (
          <div className={styles.list}>
            {authors.map(a => (
              <div key={a.id} className={styles.card}>
                {/* INFO */}
                <div className={styles.info}>
                  <div className={styles.avatar}>
                    {a.stageName[0].toUpperCase()}
                  </div>

                  <div>
                    <div className={styles.name}>
                      {a.stageName}
                    </div>
                    <div className={styles.meta}>
                      {a.name} · {a.nationality}
                    </div>
                  </div>
                </div>

                {/* STATUS */}
                <span className={`${styles.badge} ${styles.pending}`}>
                  Pending
                </span>

                {/* ACTIONS */}
                <div className={styles.actions}>
                  <button
                    className={styles.view}
                    onClick={() => setSelected(a)}
                  >
                    Xem
                  </button>

                  <button
                    className={styles.approve}
                    onClick={() => {
                      approveAuthor(a.id);
                      load();
                    }}
                  >
                    Duyệt
                  </button>

                  <button
                    className={styles.reject}
                    onClick={() => {
                      rejectAuthor(a.id);
                      load();
                    }}
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== MODAL DETAIL ===== */}
        {selected && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <h2>Thông tin tác giả</h2>

              <div className={styles.modalRow}>
                <strong>Tên thật:</strong> {selected.name}
              </div>
              <div className={styles.modalRow}>
                <strong>Nghệ danh:</strong>{" "}
                {selected.stageName}
              </div>
              <div className={styles.modalRow}>
                <strong>Ngày sinh:</strong>{" "}
                {selected.birthDate}
              </div>
              <div className={styles.modalRow}>
                <strong>Quốc tịch:</strong>{" "}
                {selected.nationality}
              </div>
              <div className={styles.modalRow}>
                <strong>ID:</strong> {selected.id}
              </div>

              <div className={styles.modalActions}>
                <button
                  className={styles.approve}
                  onClick={() => {
                    approveAuthor(selected.id);
                    setSelected(null);
                    load();
                  }}
                >
                  Duyệt
                </button>

                <button
                  className={styles.reject}
                  onClick={() => {
                    rejectAuthor(selected.id);
                    setSelected(null);
                    load();
                  }}
                >
                  Từ chối
                </button>

                <button
                  className={styles.close}
                  onClick={() => setSelected(null)}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </AdminGuard>
  );
}
