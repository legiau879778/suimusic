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
          <span>{author.name}</span>
          <span>• {author.nationality}</span>
          <span>• {author.birthDate}</span>
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
          {author.status}
        </span>
      </div>
    </section>
  );
}
