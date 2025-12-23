import type { Author } from "@/lib/authorStore";
import styles from "./author.module.css";

type Props = {
  author: Author;
};

export default function AuthorHeader({ author }: Props) {
  return (
    <section className={styles.header}>
      <div className={styles.avatar}>
        {author.stageName[0].toUpperCase()}
      </div>

      <div>
        <h1>{author.stageName}</h1>

        <div className={styles.sub}>
          <span>Tên thật: {author.name}</span>
          <span>• Quốc tịch: {author.nationality}</span>
          <span>• Sinh ngày: {author.birthDate}</span>
        </div>

        <span
          className={
            author.status === "approved"
              ? styles.approved
              : author.status === "pending"
              ? styles.pending
              : styles.rejected
          }
        >
          {author.status === "approved" && "✅ Đã duyệt"}
          {author.status === "pending" && "⏳ Chờ duyệt"}
          {author.status === "rejected" && "❌ Bị từ chối"}
        </span>
      </div>
    </section>
  );
}
