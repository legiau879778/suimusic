"use client";

import { useParams } from "next/navigation";
import { getWorks } from "@/lib/workStore";
import styles from "@/styles/workDetail.module.css";

export default function WorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const work = getWorks().find(w => w.id === id);

  if (!work) {
    return <p className={styles.empty}>Không tìm thấy tác phẩm</p>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <h1>{work.title}</h1>

        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles[work.status]}`}>
            {work.status}
          </span>

          <span
            className={`${styles.badge} ${styles[work.marketStatus]}`}
          >
            {work.marketStatus}
          </span>
        </div>

        <div className={styles.section}>
          <p><b>Thể loại:</b> {work.genre}</p>
          <p><b>Ngôn ngữ:</b> {work.language}</p>
          <p><b>Ngày hoàn thành:</b> {work.completedDate}</p>
          <p><b>Thời lượng:</b> {Math.floor(work.duration / 60)} phút</p>
        </div>

        <div className={styles.hash}>
          🔐 SHA256: {work.fileHash}
        </div>
      </div>
    </div>
  );
}
