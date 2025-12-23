"use client";

import { useEffect, useRef, useState } from "react";
import {
  getActiveWorks,
  getTrashWorks,
  softDeleteWork,
  restoreWork,
  autoCleanTrash,
} from "@/lib/workStore";
import { can } from "@/lib/permission";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import styles from "./manage.module.css";

/* ================= CONFIG ================= */

const PAGE_SIZE = 6;
type MarketFilter = "all" | "sell" | "license";

/* ================= COMPONENT ================= */

export default function ManagePage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [view, setView] =
    useState<"active" | "trash">("active");
  const [filter, setFilter] =
    useState<MarketFilter>("all");

  const [works, setWorks] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [selected, setSelected] =
    useState<any | null>(null);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const prevStatus = useRef<Record<string, string>>(
    {}
  );

  /* ================= LOAD ================= */

  function load() {
    if (!user) {
      setWorks([]);
      return;
    }

    const base =
      view === "trash"
        ? getTrashWorks()
        : getActiveWorks();

    let list =
      user.role === "admin"
        ? base
        : base.filter(
            w => w.authorId === user.id
          );

    if (filter !== "all") {
      list = list.filter(
        w => w.sellType === filter
      );
    }

    /* 🔥 ANIMATE STATUS CHANGE */
    list.forEach(w => {
      const prev = prevStatus.current[w.id];
      if (prev && prev !== w.status) {
        showToast(
          `Tác phẩm "${w.title}" ${
            w.status === "verified"
              ? "đã được duyệt"
              : "bị từ chối"
          }`,
          w.status === "verified"
            ? "success"
            : "warning"
        );
      }
      prevStatus.current[w.id] = w.status;
    });

    setWorks(list);
  }

  /* ================= EFFECT ================= */

  useEffect(() => {
    autoCleanTrash();
    load();
    window.addEventListener("works_updated", load);
    return () =>
      window.removeEventListener(
        "works_updated",
        load
      );
  }, [view, filter, user]);

  useEffect(() => {
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      ([e]) => e.isIntersecting && setPage(p => p + 1)
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, []);

  const visible = works.slice(
    0,
    page * PAGE_SIZE
  );

  /* ================= LOCKED ================= */

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.locked}>
          <h2>Chưa đăng nhập</h2>
        </div>
      </div>
    );
  }

  /* ================= RENDER ================= */

  return (
    <div className={styles.page}>
      {/* HEADER */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            Quản lý tác phẩm
          </h1>
          <p className={styles.subtitle}>
            Quản lý & khai thác thương mại
          </p>
        </div>

        <div className={styles.toggleGroup}>
          <button
            className={`${styles.toggleBtn} ${
              view === "active"
                ? styles.toggleBtnActive
                : ""
            }`}
            onClick={() => {
              setPage(1);
              setView("active");
            }}
          >
            Tác phẩm
          </button>
          <button
            className={`${styles.toggleBtn} ${
              view === "trash"
                ? styles.toggleBtnActive
                : ""
            }`}
            onClick={() => {
              setPage(1);
              setView("trash");
            }}
          >
            Thùng rác
          </button>
        </div>
      </div>

      {/* FILTER */}
      <div className={styles.filterBar}>
        {(["all", "sell", "license"] as MarketFilter[]).map(
          f => (
            <button
              key={f}
              className={`${styles.filterBtn} ${
                filter === f
                  ? styles.filterActive
                  : ""
              }`}
              onClick={() => {
                setPage(1);
                setFilter(f);
              }}
            >
              {f === "all"
                ? "Tất cả"
                : f === "sell"
                ? "Bán đứt"
                : "License"}
            </button>
          )
        )}
      </div>

      {/* GRID */}
      <div className={styles.grid}>
        {visible.map(w => (
          <div
            key={w.id}
            className={`${styles.card} ${
              styles[`status_${w.status}`]
            }`}
            onClick={() => setSelected(w)}
          >
            {/* STATUS BADGE */}
            <div
              className={`${styles.badge} ${
                styles[w.status]
              }`}
            >
              {w.status}
            </div>

            {/* MARKET BADGE */}
            {w.sellType &&
              w.sellType !== "none" && (
                <div
                  className={`${styles.badge} ${styles.market}`}
                >
                  {w.sellType === "sell"
                    ? "BÁN ĐỨT"
                    : "LICENSE"}
                </div>
              )}

            <h3 className={styles.cardTitle}>
              {w.title}
            </h3>

            {w.sellType !== "none" && (
              <div className={styles.price}>
                💰 {w.price} {w.currency}
                {w.sellType === "license" &&
                  w.royalty && (
                    <span
                      className={styles.royalty}
                      title="Royalty: % doanh thu tác giả nhận được mỗi lần cấp license"
                    >
                      · Royalty {w.royalty}%
                    </span>
                  )}
              </div>
            )}

            <div className={styles.actions}>
              {view === "active" &&
                can(user, "delete", w) && (
                  <button
                    className={styles.detailBtn}
                    onClick={e => {
                      e.stopPropagation();
                      softDeleteWork({
                        workId: w.id,
                        actor: user,
                      });
                    }}
                  >
                    Xóa
                  </button>
                )}

              {view === "trash" &&
                can(user, "restore", w) && (
                  <button
                    className={styles.detailBtn}
                    onClick={e => {
                      e.stopPropagation();
                      restoreWork({
                        workId: w.id,
                        actor: user,
                      });
                    }}
                  >
                    Khôi phục
                  </button>
                )}
            </div>
          </div>
        ))}
      </div>

      {visible.length < works.length && (
        <div ref={loadMoreRef} style={{ height: 40 }} />
      )}

      {/* MODAL */}
      {selected && (
        <div
          className={styles.modalOverlay}
          onClick={() => setSelected(null)}
        >
          <div
            className={styles.modal}
            onClick={e => e.stopPropagation()}
          >
            <h2>{selected.title}</h2>
            <p>
              <b>Hình thức:</b>{" "}
              {selected.sellType}
            </p>
            {selected.sellType !== "none" && (
              <p>
                <b>Giá:</b>{" "}
                {selected.price}{" "}
                {selected.currency}
              </p>
            )}
            {selected.royalty && (
              <p>
                <b>Royalty:</b>{" "}
                {selected.royalty}%
              </p>
            )}
            <button
              className={styles.detailBtn}
              onClick={() => setSelected(null)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
