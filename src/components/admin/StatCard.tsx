import styles from "@/styles/admin/adminDashboard.module.css";

export default function StatCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className={styles.card}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}
