"use client";

import { useAuth } from "@/context/AuthContext";
import styles from "@/app/trade/trade.module.css";
import { getPendingWorks } from "@/lib/workStore";
import { useEffect, useState } from "react";

type TradeState = "idle" | "pending" | "success";

type Work = {
  id: string;
  title: string;
  authorId: string;
  status: "pending" | "verified" | "rejected";
  buyers?: string[];
};

export default function TradePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [works, setWorks] = useState<Work[]>([]);
  const [selected, setSelected] = useState<Work | null>(null);
  const [txState, setTxState] = useState<TradeState>("idle");

  useEffect(() => {
    // mock loading
    setTimeout(() => {
      const verified = getPendingWorks().filter(
        (w: Work) => w.status === "verified"
      );
      setWorks(verified);
      setLoading(false);
    }, 600);
  }, []);

  if (!user) {
    return (
      <main className={styles.page}>
        <div className={styles.locked}>
          <h2>Bạn cần đăng nhập</h2>
          <p>Đăng nhập để thực hiện giao dịch bản quyền.</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      {/* HEADER */}
      <section className={styles.header}>
        <h1 className={styles.title}>Giao dịch bản quyền</h1>
        <p className={styles.subtitle}>
          Mua bản quyền các tác phẩm đã được xác thực.
        </p>
      </section>

      {/* GRID */}
      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      ) : works.length === 0 ? (
        <div className={styles.empty}>
          <p>Chưa có tác phẩm nào sẵn sàng giao dịch.</p>
        </div>
      ) : (
        <section className={styles.grid}>
          {works.map((w) => {
            const bought = w.buyers?.includes(user.id);

            return (
              <div key={w.id} className={styles.card}>
                <span className={styles.badge}>Verified</span>

                <h3 className={styles.cardTitle}>{w.title}</h3>

                <p className={styles.meta}>
                  Tác giả: <strong>{w.authorId}</strong>
                </p>

                <div className={styles.price}>0.1 ETH</div>

                <button
                  className={`${styles.buyBtn} ${
                    bought ? styles.disabled : ""
                  }`}
                  disabled={bought}
                  onClick={() => setSelected(w)}
                >
                  {bought ? "Đã mua" : "Mua bản quyền"}
                </button>
              </div>
            );
          })}
        </section>
      )}

      {/* MODAL CONFIRM */}
      {selected && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Xác nhận giao dịch</h3>

            <p>
              Bạn đang mua bản quyền tác phẩm:
              <br />
              <strong>{selected.title}</strong>
            </p>

            {txState === "pending" && (
              <div className={styles.txPending}>
                ⏳ Giao dịch đang xử lý…
              </div>
            )}

            {txState === "success" && (
              <div className={styles.txSuccess}>
                ✅ Giao dịch thành công
              </div>
            )}

            <div className={styles.modalActions}>
              {txState === "idle" && (
                <>
                  <button
                    className={styles.confirm}
                    onClick={() => {
                      setTxState("pending");
                      setTimeout(() => {
                        setTxState("success");
                      }, 1200);
                    }}
                  >
                    Xác nhận
                  </button>

                  <button
                    className={styles.cancel}
                    onClick={() => setSelected(null)}
                  >
                    Hủy
                  </button>
                </>
              )}

              {txState === "success" && (
                <button
                  className={styles.confirm}
                  onClick={() => {
                    setSelected(null);
                    setTxState("idle");
                  }}
                >
                  Đóng
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
