"use client";

import { useParams } from "next/navigation";
import { getWorks, updateTradeStatus } from "@/lib/workStore";
import styles from "@/styles/workDetail.module.css";

export default function WorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const work = getWorks().find(w => w.id === id);

  if (!work) return <p className={styles.empty}>Không tìm thấy tác phẩm</p>;

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <h1>{work.title}</h1>

        <div className={styles.meta}>
          <span>🔐 SHA256: {work.fileHash}</span>
          <span>
            📌 Trạng thái:{" "}
            <b className={styles[work.status]}>
              {work.status}
            </b>
          </span>
        </div>

        <h3 className={styles.sub}>Giao dịch bản quyền</h3>

        {work.trades.length === 0 && (
          <p className={styles.empty}>Chưa có giao dịch</p>
        )}

        <div className={styles.trades}>
          {work.trades.map(t => (
            <div key={t.id} className={styles.tradeCard}>
              <div>
                👤 Người mua: <b>{t.buyer}</b>
              </div>
              <div>
                📅 {new Date(t.date).toLocaleDateString()}
              </div>
              <div>
                Trạng thái: <b>{t.status}</b>
              </div>

              {t.status === "pending" && (
                <div className={styles.actions}>
                  <button
                    onClick={() =>
                      updateTradeStatus(work.id, t.id, "accepted")
                    }
                  >
                    Chấp nhận
                  </button>
                  <button
                    className={styles.reject}
                    onClick={() =>
                      updateTradeStatus(work.id, t.id, "rejected")
                    }
                  >
                    Từ chối
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
