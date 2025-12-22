"use client";

import { useEffect, useState } from "react";
import styles from "@/styles/admin/statCard.module.css";

type Props = {
  label: string;
  value: number;
  variant: "verified" | "pending" | "rejected" | "admin" | "user";
  onClick?: () => void;
};

export default function StatCard({
  label,
  value,
  variant,
  onClick,
}: Props) {
  const [display, setDisplay] = useState(0);

  /* COUNT UP */
  useEffect(() => {
    let start = 0;
    const step = Math.max(1, Math.ceil(value / 30));
    const id = setInterval(() => {
      start += step;
      if (start >= value) {
        setDisplay(value);
        clearInterval(id);
      } else setDisplay(start);
    }, 20);
    return () => clearInterval(id);
  }, [value]);

  return (
    <div
      className={`${styles.card} ${styles[variant]}`}
      onClick={onClick}
    >
      <div className={styles.value}>{display}</div>
      <div className={styles.label}>{label}</div>
    </div>
  );
}
