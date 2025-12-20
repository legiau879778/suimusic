"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
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
import styles from "@/styles/admin.module.css";

type Tab = "overview" | "authors" | "works";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("overview");
  const [authors, setAuthors] = useState<Author[]>([]);
  const [works, setWorks] = useState<Work[]>([]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.replace("/login");
      return;
    }
    setAuthors(getAuthors());
    setWorks(getWorks());
  }, [user, loading]);

  if (loading || !user) return null;

  const stats = {
    totalAuthors: authors.length,
    approvedAuthors: authors.filter(a => a.status === "approved").length,
    pendingAuthors: authors.filter(a => a.status === "pending").length,
    totalWorks: works.length,
    verifiedWorks: works.filter(w => w.status === "verified").length,
    pendingWorks: works.filter(w => w.status === "pending").length,
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Admin Dashboard</h1>
        <p>Quản lý toàn bộ hệ thống bản quyền</p>
      </div>

      {/* TABS */}
      <div className={styles.tabs}>
        <TabBtn active={tab==="overview"} onClick={()=>setTab("overview")}>
          Tổng quan
        </TabBtn>
        <TabBtn active={tab==="authors"} onClick={()=>setTab("authors")}>
          Duyệt tác giả ({stats.pendingAuthors})
        </TabBtn>
        <TabBtn active={tab==="works"} onClick={()=>setTab("works")}>
          Duyệt tác phẩm ({stats.pendingWorks})
        </TabBtn>
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <>
          <div className={styles.stats}>
            <Stat title="Tổng tác giả" value={stats.totalAuthors} />
            <Stat title="Tác giả đã duyệt" value={stats.approvedAuthors} />
            <Stat title="Tổng tác phẩm" value={stats.totalWorks} />
            <Stat title="Tác phẩm đã duyệt" value={stats.verifiedWorks} />
          </div>

          <div className={styles.chart}>
            <Bar
              label="Tác giả đã duyệt"
              value={stats.approvedAuthors}
              max={stats.totalAuthors}
            />
            <Bar
              label="Tác phẩm đã duyệt"
              value={stats.verifiedWorks}
              max={stats.totalWorks}
            />
          </div>
        </>
      )}

      {/* AUTHORS */}
      {tab === "authors" && (
        <div className={styles.list}>
          {authors.filter(a => a.status === "pending").map(a => (
            <div key={a.id} className={styles.card}>
              <h3>{a.name}</h3>
              <p className={styles.meta}>
                Mã: {a.id} • Quốc tịch: {a.nationality}
              </p>
              <div className={styles.actions}>
                <button
                  className={styles.approve}
                  onClick={() => {
                    approveAuthor(a.id);
                    setAuthors(getAuthors());
                  }}
                >
                  Duyệt
                </button>
                <button
                  className={styles.reject}
                  onClick={() => {
                    rejectAuthor(a.id);
                    setAuthors(getAuthors());
                  }}
                >
                  Từ chối
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* WORKS */}
      {tab === "works" && (
        <div className={styles.list}>
          {works.filter(w => w.status === "pending").map(w => (
            <div key={w.id} className={styles.card}>
              <h3>{w.title}</h3>
              <p className={styles.meta}>
                Author ID: {w.authorId}
              </p>
              <p className={styles.hash}>{w.fileHash}</p>
              <div className={styles.actions}>
                <button
                  className={styles.approve}
                  onClick={() => {
                    verifyWork(w.id);
                    setWorks(getWorks());
                  }}
                >
                  Duyệt tác phẩm
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===== UI COMPONENTS ===== */

function TabBtn({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`${styles.tab} ${active ? styles.active : ""}`}
    >
      {children}
    </button>
  );
}

function Stat({ title, value }: any) {
  return (
    <div className={styles.stat}>
      <p>{title}</p>
      <h2>{value}</h2>
    </div>
  );
}

function Bar({ label, value, max }: any) {
  const percent = max === 0 ? 0 : (value / max) * 100;
  return (
    <div className={styles.barWrap}>
      <p>{label}</p>
      <div className={styles.barBg}>
        <div className={styles.barFill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
