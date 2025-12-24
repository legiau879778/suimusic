"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./search.module.css";
import { getVerifiedWorks, Work } from "@/lib/workStore";

/* ===== UTILS ===== */

function norm(v?: string) {
  return (v || "Không xác định").trim();
}

function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}

/** CID -> gateway url */
function cidToGateway(cid?: string) {
  if (!cid) return "";
  const v = cid.trim();
  if (!v) return "";
  if (v.startsWith("http")) return v;
  if (v.startsWith("ipfs://")) return `https://gateway.pinata.cloud/ipfs/${v.replace("ipfs://", "")}`;
  return `https://gateway.pinata.cloud/ipfs/${v}`;
}

/** normalize ipfs://... or cid -> https gateway */
function normalizeIpfsUrl(url?: string) {
  if (!url) return "";
  const v = String(url).trim();
  if (!v) return "";
  if (v.startsWith("http")) return v;
  if (v.startsWith("ipfs://")) return `https://gateway.pinata.cloud/ipfs/${v.replace("ipfs://", "")}`;
  // nếu metadata ghi thẳng cid
  return `https://gateway.pinata.cloud/ipfs/${v}`;
}

/** chọn cover từ metadata */
function pickCover(meta: any) {
  // ưu tiên: meta.image (NFT convention) -> meta.properties.cover -> meta.cover -> animation_url
  const a =
    normalizeIpfsUrl(meta?.image) ||
    normalizeIpfsUrl(meta?.properties?.cover) ||
    normalizeIpfsUrl(meta?.cover) ||
    normalizeIpfsUrl(meta?.animation_url);

  return a || "";
}

/* ===== Metadata cache (in-memory) ===== */
type MetaMap = Record<string, any | null>;

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
    return Array.from(new Set(works.map((w) => norm(w.category)))).filter(
      (v) => v !== "Không xác định"
    );
  }, [works]);

  const languages = useMemo(() => {
    return Array.from(new Set(works.map((w) => norm(w.language)))).filter(
      (v) => v !== "Không xác định"
    );
  }, [works]);

  /* ===== POPULAR CATEGORIES ===== */

  const popularCategories = useMemo(() => {
    const map: Record<string, number> = {};
    works.forEach((w) => {
      const c = norm(w.category);
      if (c !== "Không xác định") map[c] = (map[c] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);
  }, [works]);

  /* ===== FILTER (PURE) ===== */

  const filtered = useMemo(() => {
    const k = debouncedQ.trim().toLowerCase();

    return works.filter((w) => {
      if (category !== "all" && norm(w.category) !== category) return false;
      if (language !== "all" && norm(w.language) !== language) return false;
      if (!k) return true;

      return (
        w.title.toLowerCase().includes(k) ||
        norm(w.category).toLowerCase().includes(k) ||
        norm(w.language).toLowerCase().includes(k)
      );
    });
  }, [debouncedQ, category, language, works]);

  /* ===== LOADING EFFECT ===== */

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 200);
    return () => clearTimeout(t);
  }, [debouncedQ, category, language]);

  /* ===== STATS ===== */

  const authorCount = new Set(works.map((w) => w.authorId)).size;

  /* ===== LOAD METADATA FOR COVERS ===== */

  const [metaMap, setMetaMap] = useState<MetaMap>({});

  useEffect(() => {
    let alive = true;

    async function loadMetas() {
      // lấy 24 cái đầu để UI nhanh, có thể tăng nếu bạn muốn
      const list = filtered.slice(0, 24);
      const need = list
        .map((w) => (w.hash || "").trim())
        .filter((cid) => cid && metaMap[cid] === undefined);

      if (need.length === 0) return;

      const updates: MetaMap = {};

      // fetch tuần tự để tránh spam gateway (ổn định)
      for (const cid of need) {
        try {
          const url = cidToGateway(cid);
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) throw new Error("fetch metadata failed");
          const json = await res.json();
          updates[cid] = json;
        } catch {
          updates[cid] = null;
        }
      }

      if (!alive) return;
      setMetaMap((prev) => ({ ...prev, ...updates }));
    }

    loadMetas();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        {/* ===== HERO ===== */}
        <section className={styles.hero}>
          <h1 className={styles.title}>Tra cứu tác phẩm</h1>
          <p className={styles.subtitle}>
            Tìm kiếm và xác thực bản quyền các tác phẩm số đã được duyệt.
            <br />
            Dữ liệu minh bạch, truy vết rõ ràng.
          </p>
        </section>

        {/* ===== STATS ===== */}
        <section className={styles.stats}>
          <div className={styles.statItem}>
            <strong className={styles.statValue}>{works.length}</strong>
            <span className={styles.statLabel}>Tác phẩm</span>
          </div>
          <div className={styles.statItem}>
            <strong className={styles.statValue}>{authorCount}</strong>
            <span className={styles.statLabel}>Tác giả</span>
          </div>
          <div className={styles.statItem}>
            <strong className={styles.statValue}>{categories.length}</strong>
            <span className={styles.statLabel}>Thể loại</span>
          </div>
        </section>

        {/* ===== SEARCH ===== */}
        <section className={styles.searchBox}>
          <input
            className={styles.searchInput}
            placeholder="Nhập tên tác phẩm để tra cứu…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className={styles.filterRow}>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">Tất cả thể loại</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="all">Tất cả ngôn ngữ</option>
              {languages.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {!q && popularCategories.length > 0 && (
            <div className={styles.suggestions}>
              Phổ biến:
              {popularCategories.map((c) => (
                <button key={c} onClick={() => setCategory(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ===== RESULTS ===== */}
        <section className={styles.grid}>
          {loading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={styles.skeleton} />
            ))}

          {!loading &&
            filtered.map((w: Work) => {
              const cid = (w.hash || "").trim();
              const meta = cid ? metaMap[cid] : null;
              const cover = meta ? pickCover(meta) : "";
              const cat = w.category || "—";
              const lang = w.language || "—";

              return (
                <div key={w.id} className={styles.workCard}>
                  <div className={styles.cover}>
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt={w.title} />
                    ) : (
                      <div className={styles.coverEmpty}>
                        <span>NO COVER</span>
                      </div>
                    )}
                  </div>

                  <div className={styles.workBody}>
                    <h3 className={styles.workTitle}>{w.title}</h3>

                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Thể loại</span>
                      <span className={styles.metaValue}>{cat}</span>
                    </div>

                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Ngôn ngữ</span>
                      <span className={styles.metaValue}>{lang}</span>
                    </div>

                    <div className={styles.actions}>
                      <Link href={`/work/${w.id}`} className={styles.detailBtn}>
                        Xem chi tiết
                      </Link>

                      {cid ? (
                        <a
                          className={styles.ghostBtn}
                          href={cidToGateway(cid)}
                          target="_blank"
                          rel="noreferrer"
                          title="Mở metadata từ IPFS gateway"
                        >
                          Metadata
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}

          {!loading && filtered.length === 0 && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🔍</div>
              <p>Không tìm thấy tác phẩm</p>
              <span>Thử từ khóa khác hoặc thay đổi bộ lọc</span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
