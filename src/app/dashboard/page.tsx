"use client";

import { getActiveWorks } from "@/lib/workStore";
import { useAuth } from "@/context/AuthContext";
import styles from "@/styles/admin/dashboard.module.css";

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  const works = getActiveWorks().filter(
    w => w.authorId === user.id
  );

  const totalLicenses = works.reduce(
    (sum, w) => sum + (w.licenses?.length || 0),
    0
  );

  return (
    <div className={styles.page}>
      <h1>Author Dashboard</h1>

      <div className={styles.stats}>
        <div>
          <b>Works:</b> {works.length}
        </div>
        <div>
          <b>Licenses issued:</b> {totalLicenses}
        </div>
      </div>

      <div className={styles.list}>
        {works.map(w => (
          <div key={w.id} className={styles.card}>
            <h3>{w.title}</h3>
            <div>Type: {w.sellType}</div>
            <div>
              Licenses: {w.licenses.length}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
