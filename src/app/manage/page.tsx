"use client";

import styles from "@/styles/manage.module.css";
import { getWorks } from "@/lib/workStore";
import { getCurrentUser } from "@/lib/authStore";
import Link from "next/link";

export default function ManagePage() {
  const user = getCurrentUser();
  const works = getWorks().filter(
    w => w.authorId === user?.id
  );

  return (
    <div className={styles.page}>
      <h1>Quản lý tác phẩm</h1>

      <div className={styles.grid}>
        {works.map(w => (
          <div key={w.id} className={styles.card}>
            <span className={`${styles.badge} ${styles[w.status]}`}>
              {w.status}
            </span>

            <h3>{w.title}</h3>
            <p className={styles.hash}>
              #{w.fileHash.slice(0, 14)}…
            </p>

            <div className={styles.meta}>
              <span>{w.genre}</span>
              <span>{w.language}</span>
            </div>

            {/* ✅ ON-CHAIN INFO */}
            {w.onchainTrades?.length > 0 && (
              <div className={styles.traded}>
                ✅ Đã giao dịch
                <br />
                <a
                  href={`${process.env.NEXT_PUBLIC_BLOCK_EXPLORER}/tx/${w.onchainTrades[0].txHash}`}
                  target="_blank"
                >
                  Xem giao dịch
                </a>
              </div>
            )}

            <Link href={`/work/${w.id}`}>
              Chi tiết
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
