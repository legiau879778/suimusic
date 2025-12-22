"use client";

import { useEffect, useState } from "react";
import styles from "@/styles/admin/stats.module.css";
import { getWorks } from "@/lib/workStore";
import { getUsers } from "@/lib/userStore";

type Stat = {
  label: string;
  value: number;
  color: string;
};

export default function AdminStats() {
  const [stats, setStats] = useState<Stat[]>([]);

  useEffect(() => {
    // SSR SAFE
    if (typeof window === "undefined") return;

    const works = getWorks();
    const users = getUsers();

    const verified = works.filter(w => w.status === "verified").length;
    const pending  = works.filter(w => w.status === "pending").length;
    const rejected = works.filter(w => w.status === "rejected").length;

    const admins  = users.filter(u => u.role === "admin" || u.role === "super_admin").length;
    const authors = users.filter(u => u.role === "author").length;
    const normal  = users.filter(u => u.role === "user").length;

    setStats([
      { label: "Tác phẩm đã duyệt", value: verified, color: styles.verified },
      { label: "Tác phẩm chờ duyệt", value: pending,  color: styles.pending },
      { label: "Tác phẩm bị từ chối", value: rejected, color: styles.rejected },

      { label: "Admin", value: admins, color: styles.admin },
      { label: "Tác giả", value: authors, color: styles.author },
      { label: "Người dùng", value: normal, color: styles.user },
    ]);
  }, []);

  return (
    <section className={styles.wrapper}>
      {stats.map((s, i) => (
        <div key={i} className={`${styles.card} ${s.color}`}>
          <span className={styles.value}>{s.value}</span>
          <span className={styles.label}>{s.label}</span>
        </div>
      ))}
    </section>
  );
}
