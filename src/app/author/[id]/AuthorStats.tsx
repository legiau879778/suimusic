import styles from "./author.module.css";

type Props = {
  totalWorks: number;
  verifiedWorks: number;
  pendingWorks: number;
};

export default function AuthorStats({
  totalWorks,
  verifiedWorks,
  pendingWorks,
}: Props) {
  return (
    <section className={styles.stats}>
      <div>
        <strong>{totalWorks}</strong>
        <span>Tác phẩm</span>
      </div>

      <div>
        <strong>{verifiedWorks}</strong>
        <span>Đã xác minh</span>
      </div>

      <div>
        <strong>{pendingWorks}</strong>
        <span>Đang chờ</span>
      </div>
    </section>
  );
}
