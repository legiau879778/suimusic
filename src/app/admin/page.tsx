"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import styles from "@/styles/admin.module.css";

import {
  getAuthors,
  approveAuthor,
  rejectAuthor,
  Author,
} from "@/lib/authorStore";

import {
  getWorks,
  verifyWork,
  Work,
} from "@/lib/workStore";

import { getAdminStats } from "@/lib/stats";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [authors, setAuthors] = useState<Author[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [stats, setStats] = useState<any>(null);

  /* ===== AUTH CHECK ===== */
  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/");
    }
  }, [user, loading]);

  const reload = () => {
    setAuthors(getAuthors().filter(a => a.status === "pending"));
    setWorks(getWorks().filter(w => w.status === "pending"));
    setStats(getAdminStats());
  };

  useEffect(() => {
    if (user?.role === "admin") reload();
  }, [user]);

  if (!user || user.role !== "admin" || !stats) return null;

  const authorMax = Math.max(
    stats.authors.pending,
    stats.authors.approved,
    stats.authors.rejected,
    1
  );

  const workTotal =
    stats.works.pending +
    stats.works.verified +
    stats.works.traded || 1;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Admin Dashboard</h1>

      {/* ================== 1️⃣ CHARTS ================== */}
      <section className={styles.section}>
        <h2>Thống kê hệ thống</h2>

        <div className={styles.summary}>
          <div className={styles.card}>
            <h3>Tác giả</h3>
            <p>Tổng: {stats.authors.total}</p>
            <p>Pending: {stats.authors.pending}</p>
            <p>Approved: {stats.authors.approved}</p>
            <p>Rejected: {stats.authors.rejected}</p>
          </div>

          <div className={styles.card}>
            <h3>Tác phẩm</h3>
            <p>Tổng: {stats.works.total}</p>
            <p>Pending: {stats.works.pending}</p>
            <p>Verified: {stats.works.verified}</p>
            <p>Traded: {stats.works.traded}</p>
          </div>
        </div>

        {/* BAR CHART */}
        <div className={styles.barChart}>
          {[
            { label: "Pending", value: stats.authors.pending },
            { label: "Approved", value: stats.authors.approved },
            { label: "Rejected", value: stats.authors.rejected },
          ].map(i => (
            <div key={i.label} className={styles.barItem}>
              <div
                className={styles.bar}
                style={{ height: `${(i.value / authorMax) * 100}%` }}
              />
              <span>{i.label}</span>
              <b>{i.value}</b>
            </div>
          ))}
        </div>
      </section>

      {/* ================== 2️⃣ DUYỆT TÁC GIẢ ================== */}
      <section className={styles.section}>
        <h2>Duyệt tác giả</h2>

        {authors.length === 0 && (
          <p className={styles.empty}>Không có tác giả chờ duyệt</p>
        )}

        {authors.map(a => (
          <div key={a.id} className={styles.reviewCard}>
            <div>
              <b>{a.stageName}</b> ({a.name})<br />
              Ngày sinh: {a.birthDate}<br />
              Quốc tịch: {a.nationality}
            </div>

            <div className={styles.actions}>
              <button
                className={styles.approve}
                onClick={() => {
                  approveAuthor(a.id);
                  reload();
                }}
              >
                Duyệt
              </button>

              <button
                className={styles.reject}
                onClick={() => {
                  rejectAuthor(a.id);
                  reload();
                }}
              >
                Từ chối
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* ================== 3️⃣ DUYỆT TÁC PHẨM ================== */}
      <section className={styles.section}>
        <h2>Duyệt tác phẩm</h2>

        {works.length === 0 && (
          <p className={styles.empty}>Không có tác phẩm chờ duyệt</p>
        )}

        {works.map(w => (
          <div key={w.id} className={styles.reviewCard}>
            <div>
              <b>{w.title}</b>
              <div className={styles.hash}>{w.fileHash}</div>
            </div>

            <div className={styles.actions}>
              <button
                className={styles.approve}
                onClick={() => {
                  verifyWork(w.id);
                  reload();
                }}
              >
                Duyệt
              </button>

              <button
                className={styles.reject}
                onClick={() => {
                  alert("Đã từ chối (mock)");
                  reload();
                }}
              >
                Từ chối
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
