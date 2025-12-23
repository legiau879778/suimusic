"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./search.module.css";
import { getVerifiedWorks, Work } from "@/lib/workStore";

/* ===== UTILS ===== */

function norm(v?: string) {
  return (v || "Không xác định").trim();
}

/* debounce hook */
function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(
      () => setDebounced(value),
      delay
    );
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}

export default function SearchPage() {
  const works = getVerifiedWorks();

  /* ===== STATE ===== */
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [language, setLanguage] = useState("all");
  const [loading, setLoading] = useState(false);

  const debouncedQ = useDebounce(q);

  /* ===== AUTO CATEGORY / LANGUAGE ===== */

  const categories = useMemo(() => {
    return Array.from(
      new Set(works.map(w => norm(w.category)))
    ).filter(v => v !== "Không xác định");
  }, [works]);

  const languages = useMemo(() => {
    return Array.from(
      new Set(works.map(w => norm(w.language)))
    ).filter(v => v !== "Không xác định");
  }, [works]);

  /* ===== POPULAR CATEGORIES ===== */

  const popularCategories = useMemo(() => {
    const map: Record<string, number> = {};
    works.forEach(w => {
      const c = norm(w.category);
      if (c !== "Không xác định") {
        map[c] = (map[c] || 0) + 1;
      }
    });

    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);
  }, [works]);

  /* ===== FILTER (PURE) ===== */

  const filtered = useMemo(() => {
    const k = debouncedQ
      .trim()
      .toLowerCase();

    return works.filter(w => {
      if (
        category !== "all" &&
        norm(w.category) !== category
      )
        return false;

      if (
        language !== "all" &&
        norm(w.language) !== language
      )
        return false;

      if (!k) return true;

      return (
        w.title.toLowerCase().includes(k) ||
        norm(w.category)
          .toLowerCase()
          .includes(k)
      );
    });
  }, [debouncedQ, category, language, works]);

  /* ===== LOADING EFFECT ===== */

  useEffect(() => {
    setLoading(true);

    const t = setTimeout(() => {
      setLoading(false);
    }, 200);

    return () => clearTimeout(t);
  }, [debouncedQ, category, language]);

  /* ===== STATS ===== */

  const authorCount = new Set(
    works.map(w => w.authorId)
  ).size;

  return (
    <main className={styles.page}>
      {/* ===== HERO ===== */}
      <section className={styles.hero}>
        <h1>Tra cứu tác phẩm</h1>
        <p>
          Tìm kiếm và xác thực bản quyền các tác
          phẩm số đã được duyệt.
          <br />
          Dữ liệu minh bạch, truy vết rõ ràng.
        </p>
      </section>

      {/* ===== STATS ===== */}
      <section className={styles.stats}>
        <div>
          <strong>{works.length}</strong>
          <span>Tác phẩm</span>
        </div>
        <div>
          <strong>{authorCount}</strong>
          <span>Tác giả</span>
        </div>
        <div>
          <strong>{categories.length}</strong>
          <span>Thể loại</span>
        </div>
      </section>

      {/* ===== SEARCH ===== */}
      <section className={styles.searchBox}>
        <input
          className={styles.searchInput}
          placeholder="Nhập tên tác phẩm để tra cứu…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />

        <div className={styles.filterRow}>
          <select
            value={category}
            onChange={e =>
              setCategory(e.target.value)
            }
          >
            <option value="all">
              Tất cả thể loại
            </option>
            {categories.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={language}
            onChange={e =>
              setLanguage(e.target.value)
            }
          >
            <option value="all">
              Tất cả ngôn ngữ
            </option>
            {languages.map(l => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {!q && popularCategories.length > 0 && (
          <div className={styles.suggestions}>
            Phổ biến:
            {popularCategories.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ===== RESULTS ===== */}
      <section className={styles.grid}>
        {loading &&
          Array.from({ length: 6 }).map(
            (_, i) => (
              <div
                key={i}
                className={styles.skeleton}
              />
            )
          )}

        {!loading &&
          filtered.map((w: Work) => (
            <div key={w.id} className={styles.card}>
              <h3>{w.title}</h3>

              <p>
                Thể loại:{" "}
                <strong>
                  {w.category || "—"}
                </strong>
              </p>

              <p>
                Ngôn ngữ:{" "}
                <strong>
                  {w.language || "—"}
                </strong>
              </p>

              <Link
                href={`/work/${w.id}`}
                className={styles.detailBtn}
              >
                Xem chi tiết
              </Link>
            </div>
          ))}

        {!loading && filtered.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              🔍
            </div>
            <p>Không tìm thấy tác phẩm</p>
            <span>
              Thử từ khóa khác hoặc thay đổi bộ
              lọc
            </span>
          </div>
        )}
      </section>
    </main>
  );
}
