"use client";

import styles from "@/styles/search.module.css";
import { getWorks } from "@/lib/workStore";
import Link from "next/link";
import { useState } from "react";

export default function SearchPage() {
  const works = getWorks();
  const [q, setQ] = useState("");

  const filtered = works.filter(w =>
    w.title.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className={styles.page}>
      <h1>Tra cứu tác phẩm</h1>

      <input
        className={styles.search}
        placeholder="Nhập tên tác phẩm hoặc hash…"
        value={q}
        onChange={e => setQ(e.target.value)}
      />

      <div className={styles.grid}>
        {filtered.map(w => (
          <div key={w.id} className={styles.card}>
            <span className={styles.badge}>
              {w.onchainTrades?.length > 0
                ? "Đã giao dịch"
                : "Chưa giao dịch"}
            </span>

            <h3>{w.title}</h3>
            <p className={styles.author}>
              Tác giả: {w.authorId}
            </p>

            <p className={styles.hash}>
              #{w.fileHash.slice(0, 14)}…
            </p>

            <Link href={`/work/${w.id}`}>
              Xem chi tiết →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
