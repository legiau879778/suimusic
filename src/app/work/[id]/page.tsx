"use client";

import { useParams } from "next/navigation";
import { getWork } from "@/lib/workStore";
import styles from "@/styles/work.module.css";

export default function WorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const work = getWork(id);

  if (!work) return <p style={{ padding: 40 }}>Không tìm thấy tác phẩm</p>;

  return (
    <div className={styles.page}>
      <h1>{work.title}</h1>

      <div className={styles.meta}>
        <p><b>Tác giả:</b> {work.author}</p>
        <p><b>Chủ sở hữu:</b> {work.owner}</p>
        <p><b>Trạng thái:</b> {work.status}</p>
      </div>

      <div className={styles.hash}>
        <b>SHA256:</b>
        <span>{work.fileHash}</span>
      </div>

      <h2>Lịch sử giao dịch</h2>

      <div className={styles.timeline}>
        {work.history.map((h, i) => (
          <div key={i} className={styles.event}>
            <span className={styles.dot} />
            <div>
              <p><b>{h.type}</b></p>
              {h.txHash && <p>Tx: {h.txHash}</p>}
              <p className={styles.time}>
                {new Date(h.time).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
