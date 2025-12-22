"use client";

import { useMemo, useState } from "react";
import styles from "./search.module.css";
import { getPublicWorks } from "@/lib/workStore";
import Link from "next/link";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const works = getPublicWorks();

  const filtered = useMemo(() => {
    if (!q.trim()) return works;
    const k = q.toLowerCase();
    return works.filter(
      w =>
        w.title.toLowerCase().includes(k) ||
        w.authorId.toLowerCase().includes(k)
    );
  }, [q, works]);

  return (
    <main className={styles.page}>
      <h1>Tra cứu tác phẩm</h1>

      <input
        className={styles.input}
        placeholder="Tên tác phẩm / tác giả"
        value={q}
        onChange={e => setQ(e.target.value)}
      />

      <div className={styles.grid}>
        {filtered.map(w => (
          <div key={w.id} className={styles.card}>
            <span className={styles.badge}>Đã xác thực</span>
            <h3>{w.title}</h3>
            <p>{w.authorId}</p>

            <Link href={`/work/${w.id}`}>Xem chi tiết</Link>
          </div>
        ))}
      </div>
    </main>
  );
}
