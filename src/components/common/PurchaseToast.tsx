"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "@/styles/profile.module.css";

function shortHash(h: string) {
  if (!h) return "";
  return `${h.slice(0, 10)}…${h.slice(-8)}`;
}

export default function PurchaseToast({
  open,
  title = "Mua Membership thành công",
  subtitle = "Quyền đã được kích hoạt ngay lập tức",
  txHash,
  onClose,
  durationMs = 4200,
}: {
  open: boolean;
  title?: string;
  subtitle?: string;
  txHash?: string;
  onClose: () => void;
  durationMs?: number;
}) {
  const [closing, setClosing] = useState(false);
  const [copied, setCopied] = useState(false);

  const closeTimer = useRef<number | null>(null);
  const outTimer = useRef<number | null>(null);
  const copiedTimer = useRef<number | null>(null);

  // confetti tạo mới mỗi lần open
  const confetti = useMemo(
    () =>
      Array.from({ length: 16 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.25,
        dur: 1.25 + Math.random() * 0.65,
        rot: Math.random() * 240,
        size: 6 + Math.random() * 7,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open]
  );

  const doClose = () => {
    // tránh gọi nhiều lần
    if (closing) return;

    setClosing(true);

    if (outTimer.current) window.clearTimeout(outTimer.current);
    outTimer.current = window.setTimeout(() => {
      onClose();
    }, 220);
  };

  useEffect(() => {
    // cleanup timers
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
      if (outTimer.current) window.clearTimeout(outTimer.current);
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    setClosing(false);
    setCopied(false);

    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      doClose();
    }, durationMs);

    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, durationMs]);

  const copyTx = async () => {
    if (!txHash) return;
    try {
      await navigator.clipboard.writeText(txHash);
      setCopied(true);
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1100);
    } catch {
      // ignore
    }
  };

  if (!open) return null;

  return (
    <div className={styles.toastLayer} aria-live="polite">
      <div className={`${styles.toastCard} ${closing ? styles.toastClosing : ""}`}>
        {/* confetti nhẹ - nằm TRONG card */}
        <div className={styles.toastConfetti} aria-hidden="true">
          {confetti.map((c) => (
            <span
              key={c.id}
              className={styles.confettiPiece}
              style={{
                left: `${c.left}%`,
                animationDelay: `${c.delay}s`,
                animationDuration: `${c.dur}s`,
                transform: `rotate(${c.rot}deg)`,
                width: `${c.size}px`,
                height: `${c.size * 1.6}px`,
              }}
            />
          ))}
        </div>

        <div className={styles.toastIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M20 7L10.5 17 4 10.5"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className={styles.toastBody}>
          <div className={styles.toastTitle}>{title}</div>
          <div className={styles.toastSub}>{subtitle}</div>

          {txHash && (
            <div className={styles.toastTxRow}>
              <span className={styles.toastTxLabel}>Tx:</span>
              <span className={styles.toastTxHash} title={txHash}>
                {shortHash(txHash)}
              </span>

              <button
                className={`${styles.toastCopyBtn} ${copied ? styles.toastCopied : ""}`}
                onClick={copyTx}
                type="button"
              >
                {copied ? "COPIED" : "COPY"}
              </button>
            </div>
          )}
        </div>

        <button className={styles.toastClose} onClick={doClose} aria-label="close" type="button">
          ✕
        </button>
      </div>
    </div>
  );
}
