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
  return new Date(ts).toLocaleString("en-US");
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
  // Use suiscan because it is popular and stable for demos.
  // If you want another explorer (official), change this line.
  return `https://suiscan.xyz/${net}/tx/${digest}`;
}

function statusText(s: TradeStatus) {
  if (s === "success") return "Success";
  if (s === "failed") return "Failed";
  return "Processing";
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
     - every 8s check all pending tx
     - if tx not found => keep pending
     - if success => success, if fail => failed
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

        // sequential poll (safe rate-limit). If you want faster, use Promise.all with limits.
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
            // digest not indexed / not found -> keep pending
          }
        }
      } finally {
        pollingRef.current = false;
      }
    };

    // call once immediately
    void tick();

    const id = window.setInterval(() => void tick(), 8000);
    return () => window.clearInterval(id);
  }, [userId, suiClient]);

  /* ================= EMPTY GUARD ================= */

  if (!userId) {
    return (
      <div className={styles.card}>
        <div className={styles.historyHeader}>
          <h2>Transaction history</h2>
          <span className={styles.historySub}>Please sign in to view</span>
        </div>

        <div className={styles.emptyState}>
          <Clock size={36} />
          <p>Not signed in</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      {/* HEADER */}
      <div className={styles.historyHeader}>
        <div>
          <h2 className={styles.historyTitle}>Transaction history</h2>
          <div className={styles.historySub}>Your on-chain transactions (auto status updates)</div>
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
            All
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
          <div className={styles.statLabel}>Total</div>
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
          <div className={styles.statLabel}>Spent (est.)</div>
          <div className={styles.statValue}>{stats.spent.toFixed(2)} SUI</div>
        </div>
      </div>

      {/* EMPTY */}
      {!filtered.length && (
        <div className={styles.emptyState}>
          <Clock size={36} />
          <p>No transactions for this filter</p>
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
                      title="Open in Sui Explorer"
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
        Tip: <b>Pending</b> transactions will auto-update to <b>Success/Failed</b> after RPC indexing (polls every 8 seconds).
      </div>
    </div>
  );
}
