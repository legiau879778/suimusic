import StatCard from "@/components/admin/StatCard";
import styles from "@/styles/admin/adminDashboard.module.css";
import { buildAdminStats} from "@/lib/adminStats";

export default function AdminDashboard() {
  const stats = buildAdminStats();

  return (
    <>
      <h1 className={styles.heading}>Dashboard</h1>

      <div className={styles.grid}>
        <StatCard title="Tác phẩm đã duyệt" value={stats.verified} />
        <StatCard title="Chờ duyệt" value={stats.pending} />
        <StatCard title="Bị từ chối" value={stats.rejected} />
        <StatCard title="Giao dịch" value={stats.trades} />
      </div>
    </>
  );
}
