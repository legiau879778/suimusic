"use client";

import { useParams } from "next/navigation";
import styles from "@/app/work/[id]/workDetail.module.css";
import { getWorks } from "@/lib/workStore";
import { useAuth } from "@/context/AuthContext";

type ReviewLog = {
  admin: string;
  action: "approved" | "rejected";
  time: string;
};

type TradeLog = {
  buyer: string;
  time: string;
  price: string;
};

export default function WorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const work = getWorks().find((w) => w.id === id);

  if (!work) {
    return (
      <main className={styles.page}>
        <div className={styles.notFound}>
          <h2>Không tìm thấy tác phẩm</h2>
          <p>Tác phẩm không tồn tại hoặc đã bị xoá.</p>
        </div>
      </main>
    );
  }

  /* MOCK DATA – sẵn sàng nối store thật */
  const reviewLogs: ReviewLog[] =
    work.status === "pending"
      ? []
      : [
          {
            admin: "admin@chainstorm.io",
            action: work.status === "verified" ? "approved" : "rejected",
            time: new Date(work.createdAt).toLocaleString(),
          },
        ];

  const tradeLogs: TradeLog[] =
    work.status === "verified"
      ? [
          {
            buyer: "0x9aE3…42cD",
            time: new Date().toLocaleString(),
            price: "0.1 ETH",
          },
        ]
      : [];

  return (
    <main className={styles.page}>
      {/* HEADER */}
      <section className={styles.header}>
        <div>
          <h1 className={styles.title}>{work.title}</h1>
          <p className={styles.subtitle}>
            Tác giả: <strong>{work.authorId}</strong>
          </p>
        </div>

        <span
          className={`${styles.status} ${
            work.status === "verified"
              ? styles.verified
              : work.status === "pending"
              ? styles.pending
              : styles.rejected
          }`}
        >
          {work.status === "verified"
            ? "Đã xác thực"
            : work.status === "pending"
            ? "Đang chờ duyệt"
            : "Từ chối"}
        </span>
      </section>

      {/* INFO */}
      <section className={styles.card}>
        <div className={styles.row}>
          <span>ID tác phẩm</span>
          <code>{work.id}</code>
        </div>

        <div className={styles.row}>
          <span>Ngày tạo</span>
          <span>{new Date(work.createdAt).toLocaleDateString()}</span>
        </div>

        <div className={styles.row}>
          <span>Hash tác phẩm</span>
          <code>{work.fileHash || "0x…hash"}</code>
        </div>
      </section>

      {/* ACTION */}
      {work.status === "verified" && (
        <section className={styles.action}>
          <button className={styles.buyBtn}>
            Mua bản quyền (0.1 ETH)
          </button>
        </section>
      )}

      {/* REVIEW LOG */}
      <section className={styles.section}>
        <h2>Lịch sử duyệt</h2>

        {reviewLogs.length === 0 ? (
          <p className={styles.empty}>Chưa có lịch sử duyệt.</p>
        ) : (
          <div className={styles.logList}>
            {reviewLogs.map((log, i) => (
              <div key={i} className={styles.logItem}>
                <span className={styles.logAction}>
                  {log.action === "approved" ? "✔ Duyệt" : "✖ Từ chối"}
                </span>
                <span>{log.admin}</span>
                <span className={styles.logTime}>{log.time}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* TRADE LOG */}
      <section className={styles.section}>
        <h2>Lịch sử giao dịch</h2>

        {tradeLogs.length === 0 ? (
          <p className={styles.empty}>Chưa có giao dịch.</p>
        ) : (
          <div className={styles.logList}>
            {tradeLogs.map((t, i) => (
              <div key={i} className={styles.logItem}>
                <span>Người mua: {t.buyer}</span>
                <span>{t.price}</span>
                <span className={styles.logTime}>{t.time}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      {!user && (
        <section className={styles.notice}>
          <p>Đăng nhập để thực hiện giao dịch hoặc quản lý tác phẩm.</p>
        </section>
      )}
    </main>
  );
}
