import { Work } from "@/lib/workStore";
import styles from "./author.module.css";

type Props = {
  works: Work[];
};

export default function AuthorWorks({ works }: Props) {
  if (!works.length) {
    return (
      <div className={styles.empty}>
        Chưa có tác phẩm
      </div>
    );
  }

  return (
    <section className={styles.works}>
      {works.map((w) => (
        <div key={w.id} className={styles.workCard}>
          <h3>{w.title}</h3>

          <span className={styles.status}>
            {w.status === "verified" && "✅ Đã xác minh"}
            {w.status === "pending" && "⏳ Đang chờ"}
            {w.status === "rejected" && "❌ Bị từ chối"}
          </span>

          {w.verifiedAt && (
            <small>
              Verified:{" "}
              {new Date(w.verifiedAt).toLocaleString()}
            </small>
          )}
        </div>
      ))}
    </section>
  );
}
