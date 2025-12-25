"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "@/styles/profile.module.css";
import { useAuth } from "@/context/AuthContext";
import { useSuiClient } from "@mysten/dapp-kit";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Clock,
  Funnel,
  LinkSimple,
  XCircle,
} from "@phosphor-icons/react";

import type { Trade, TradeStatus, TradeType } from "@/lib/tradeStore";
import {
  getUserTrades,
  setUserTrades,
  subscribeTrades,
  updateTradeStatus,
} from "@/lib/tradeStore";

/* ================= HELPERS ================= */

function shortHash(h: string) {
  if (!h) return "—";
  if (h.length <= 14) return h;
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString("vi-VN");
}

type Filter = "all" | TradeType;

function getSuiNetwork(): "mainnet" | "testnet" | "devnet" {
  const v = (process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet").toLowerCase();
  if (v.includes("main")) return "mainnet";
  if (v.includes("dev")) return "devnet";
  return "testnet";
}

function explorerTxUrl(digest: string) {
  const net = getSuiNetwork();
  // Sui Explorer pattern: https://suiscan.xyz/<network>/tx/<digest>
  // Mình dùng suiscan vì phổ biến, ổn định cho demo đồ án.
  // Nếu bạn muốn explorer khác (official), mình đổi 1 dòng này.
  return `https://suiscan.xyz/${net}/tx/${digest}`;
}

function statusText(s: TradeStatus) {
  if (s === "success") return "Thành công";
  if (s === "failed") return "Thất bại";
  return "Đang xử lý";
}

/* ================= COMPONENT ================= */

export default function TradeHistory() {
  const { user } = useAuth();
  const suiClient = useSuiClient();

  const userId = (user?.id || user?.email || "").trim();

  const [filter, setFilter] = useState<Filter>("all");
  const [trades, setTrades] = useState<Trade[]>([]);
  const pollingRef = useRef(false);

  // load local trades
  useEffect(() => {
    if (!userId) {
      setTrades([]);
      return;
    }
    setTrades(getUserTrades(userId));
  }, [userId]);

  // realtime subscribe
  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeTrades(userId, () => {
      setTrades(getUserTrades(userId));
    });
    return () => unsub();
  }, [userId]);

  // filter
  const filtered = useMemo(() => {
    if (filter === "all") return trades;
    return trades.filter((t) => t.type === filter);
  }, [trades, filter]);

  // stats
  const stats = useMemo(() => {
    const total = trades.length;
    const pending = trades.filter((t) => t.status === "pending").length;
    const success = trades.filter((t) => t.status === "success").length;
    const failed = trades.filter((t) => t.status === "failed").length;
    const spent = trades
      .filter((t) => t.type === "buy" || t.type === "license")
      .reduce((sum, t) => sum + (t.amountSui || 0), 0);

    return { total, pending, success, failed, spent };
  }, [trades]);

  /* ================= REALTIME ON-CHAIN POLLING =================
     - mỗi 8s check tất cả tx pending
     - nếu tx not found => vẫn pending
     - nếu success => success, nếu fail => failed
  =============================================================== */

  useEffect(() => {
    if (!userId) return;

    const tick = async () => {
      if (pollingRef.current) return;
      pollingRef.current = true;

      try {
        const current = getUserTrades(userId);
        const pendings = current.filter((t) => t.status === "pending" && t.txHash);

        if (!pendings.length) return;

        // poll tuần tự (an toàn rate-limit). Nếu bạn muốn nhanh hơn, mình đổi sang Promise.all với limit.
        for (const t of pendings) {
          try {
            const tx = await suiClient.getTransactionBlock({
              digest: t.txHash,
              options: { showEffects: true },
            });

            const st = tx.effects?.status?.status;
            if (st === "success") {
              updateTradeStatus(userId, t.txHash, "success");
            } else if (st === "failure") {
              updateTradeStatus(userId, t.txHash, "failed");
            }
          } catch (e: any) {
            // digest chưa index / chưa thấy -> keep pending
          }
        }
      } finally {
        pollingRef.current = false;
      }
    };

    // gọi ngay 1 lần
    void tick();

    const id = window.setInterval(() => void tick(), 8000);
    return () => window.clearInterval(id);
  }, [userId, suiClient]);

  /* ================= EMPTY GUARD ================= */

  if (!userId) {
    return (
      <div className={styles.card}>
        <div className={styles.historyHeader}>
          <h2>Lịch sử giao dịch</h2>
          <span className={styles.historySub}>Vui lòng đăng nhập để xem</span>
        </div>

        <div className={styles.emptyState}>
          <Clock size={36} />
          <p>Chưa đăng nhập</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      {/* HEADER */}
      <div className={styles.historyHeader}>
        <div>
          <h2 className={styles.historyTitle}>Lịch sử giao dịch</h2>
          <div className={styles.historySub}>Giao dịch on-chain của chính bạn (auto cập nhật trạng thái)</div>
        </div>

        <div className={styles.historyFilters}>
          <span className={styles.filterIcon} aria-hidden="true">
            <Funnel size={16} />
          </span>

          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`${styles.filterPill} ${filter === "all" ? styles.filterActive : ""}`}
          >
            Tất cả
          </button>

          <button
            type="button"
            onClick={() => setFilter("buy")}
            className={`${styles.filterPill} ${filter === "buy" ? styles.filterActive : ""}`}
          >
            Buy
          </button>

          <button
            type="button"
            onClick={() => setFilter("sell")}
            className={`${styles.filterPill} ${filter === "sell" ? styles.filterActive : ""}`}
          >
            Sell
          </button>

          <button
            type="button"
            onClick={() => setFilter("license")}
            className={`${styles.filterPill} ${filter === "license" ? styles.filterActive : ""}`}
          >
            License
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className={styles.historyStats}>
        <div className={styles.statBox}>
          <div className={styles.statLabel}>Tổng</div>
          <div className={styles.statValue}>{stats.total}</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statLabel}>Pending</div>
          <div className={styles.statValue}>{stats.pending}</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statLabel}>Success</div>
          <div className={styles.statValue}>{stats.success}</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statLabel}>Failed</div>
          <div className={styles.statValue}>{stats.failed}</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statLabel}>Chi (ước tính)</div>
          <div className={styles.statValue}>{stats.spent.toFixed(2)} SUI</div>
        </div>
      </div>

      {/* EMPTY */}
      {!filtered.length && (
        <div className={styles.emptyState}>
          <Clock size={36} />
          <p>Chưa có giao dịch nào theo bộ lọc này</p>
        </div>
      )}

      {/* LIST */}
      {filtered.length > 0 && (
        <div className={styles.tradeList}>
          {filtered.map((t) => (
            <div key={t.id} className={styles.tradeRow}>
              {/* LEFT: TYPE */}
              <div className={styles.tradeType}>
                {t.type === "buy" ? (
                  <ArrowDown size={18} />
                ) : t.type === "sell" ? (
                  <ArrowUp size={18} />
                ) : (
                  <LinkSimple size={18} />
                )}
              </div>

              {/* MAIN */}
              <div className={styles.tradeMain}>
                <div className={styles.tradeTitle}>{t.title}</div>

                <div className={styles.tradeMeta}>
                  <span>{formatTime(t.createdAt)}</span>

                  {/* ✅ click txHash -> Sui Explorer */}
                  {t.txHash ? (
                    <a
                      className={styles.txLink}
                      href={explorerTxUrl(t.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      title="Mở trên Sui Explorer"
                    >
                      {shortHash(t.txHash)}
                    </a>
                  ) : (
                    <span className={styles.mono}>—</span>
                  )}
                </div>
              </div>

              {/* RIGHT */}
              <div className={styles.tradeRight}>
                <div className={styles.tradeAmount}>{t.amountSui} SUI</div>

                <div
                  className={`${styles.tradeStatus} ${
                    t.status === "success"
                      ? styles.statusOk
                      : t.status === "pending"
                      ? styles.statusPending
                      : styles.statusFail
                  }`}
                >
                  {t.status === "success" && (
                    <>
                      <CheckCircle size={14} /> {statusText(t.status)}
                    </>
                  )}
                  {t.status === "pending" && (
                    <>
                      <Clock size={14} /> {statusText(t.status)}
                    </>
                  )}
                  {t.status === "failed" && (
                    <>
                      <XCircle size={14} /> {statusText(t.status)}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* HINT */}
      <div className={styles.historyHint}>
        Tip: giao dịch <b>Pending</b> sẽ tự đổi sang <b>Success/Failed</b> khi RPC index xong (poll mỗi 8 giây).
      </div>
    </div>
  );
}
