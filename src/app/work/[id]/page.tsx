"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getWorkById, syncWorksFromChain, Work } from "@/lib/workStore";
import { getReviewLogsByWork } from "@/lib/reviewLogStore";
import styles from "@/styles/work.module.css";

export default function WorkDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [work, setWork] = useState<Work | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!id) return;
      await syncWorksFromChain();
      if (!alive) return;
      setWork(getWorkById(id));
    }
    load();
    const onUpdate = () => {
      setWork(getWorkById(id));
    };
    window.addEventListener("works_updated", onUpdate);
    return () => {
      alive = false;
      window.removeEventListener("works_updated", onUpdate);
    };
  }, [id]);

  const reviewLogs = useMemo(() => {
    return getReviewLogsByWork(id).map((l) => ({
      ...l,
      time: new Date(l.time).toLocaleString(),
    }));
  }, [id]);

  if (!work) {
    return (
      <p style={{ padding: 40 }}>
        Work not found
      </p>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{work.title}</h1>

        <p className={styles.meta}>
          <strong>Status:</strong>{" "}
          {work.status}
        </p>

        {work.hash && (
          <p className={styles.hash}>
            <strong>SHA-256:</strong> {work.hash}
          </p>
        )}

        <hr className={styles.divider} />

        <h2>Review history</h2>

        {reviewLogs.length === 0 && (
          <p className={styles.empty}>
            No review history yet.
          </p>
        )}

        <ul className={styles.timeline}>
          {reviewLogs.map(log => (
            <li key={log.id} className={styles.logItem}>
              <div>
                <strong>{log.adminEmail}</strong>{" "}
                {log.action === "approved"
                  ? "approved"
                  : "rejected"}
              </div>

              <div className={styles.time}>
                {log.time}
              </div>

              {log.reason && (
                <div className={styles.reason}>
                  <strong>Reason:</strong>{" "}
                  {log.reason}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
