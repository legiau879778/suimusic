"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getVerifiedWorks,
  patchWork,
  setWorkMetadata,
  setWorkVotes,
  syncWorksFromChain,
  type Work,
} from "@/lib/workStore";
import { toGateway } from "@/lib/profileStore";
import { useSyncWorkOwner } from "@/hooks/useSyncWorkOwner";
import { explorerObjectUrl, shortAddr } from "@/lib/suiExplorer";
import { canUseWorkVote, getVoteCountForWork } from "@/lib/workVoteChain";
impoz sssrt { useSuiClient } from "@mysten/dapp-kit";
import { fetchWalrusMetadata } from "@/lib/walrusMetaCache";
import styles from "./marketplace.module.css";

type Filter = "all" | "exclusive" | "license";
type SortKey = "newest" | "oldest" | "title" | "royalty" | "top";

type MetaPreview = {
  title?: string;
  image?: string;
  duration?: number | string;
  category?: string;
  language?: string;
};

function resolveMetaInput(w: any) {
  const raw = String(
    w?.walrusMetaId || w?.metadataCid || w?.metadata || w?.hash || ""
  ).trim();
  if (!raw) return "";
  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("walrus:") ||
    raw.startsWith("walrus://") ||
    raw.startsWith("/api/walrus/blob/")
  ) {
    return raw;
  }
  return `walrus:${raw}`;
}

function resolveCoverFromMeta(meta: any, w: any) {
  const raw =
    w?.metaImage ||
    meta?.image ||
    meta?.cover ||
    meta?.properties?.cover?.url ||
    meta?.properties?.cover_image ||
    meta?.properties?.image ||
    "";
  const byMeta = toGateway(raw);
  if (byMeta) return byMeta;
  const coverId = String(w?.walrusCoverId || "").trim();
  if (coverId) return toGateway(`walrus:${coverId}`);
  return "";
}

function resolveTitleFromMeta(meta: any, w: any) {
  return (
    String(w?.metaTitle || "").trim() ||
    String(meta?.name || meta?.title || "").trim() ||
    String(w?.title || "").trim() ||
    "Untitled"
  );
}

function getWorkTime(w: any): number {
  const a =
    Date.parse(w?.createdDate || "") ||
    Date.parse(w?.mintedAt || "") ||
    (typeof w?.verifiedAt === "number" ? w.verifiedAt : Date.parse(w?.verifiedAt || "")) ||
    (typeof w?.reviewedAt === "number" ? w.reviewedAt : Date.parse(w?.reviewedAt || "")) ||
    0;
  return Number.isFinite(a) ? a : 0;
}

export default function MarketplacePage() {
  const suiClient = useSuiClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [baseList, setBaseList] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [metaCache, setMetaCache] = useState<Record<string, MetaPreview>>({});
  const [voteCache, setVoteCache] = useState<Record<string, number>>({});

  function load() {
    const works = getVerifiedWorks();
    setBaseList(works);
  }

  useEffect(() => {
    let alive = true;
    async function init() {
      setLoading(true);
      await syncWorksFromChain();
      if (!alive) return;
      load();
      setLoading(false);
    }
    init();
    window.addEventListener("works_updated", load);
    return () => {
      alive = false;
      window.removeEventListener("works_updated", load);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const queue = baseList
      .slice(0, 60)
      .filter((w) => w?.id && !metaCache[w.id]);

    async function run() {
      const CONC = 6;
      let i = 0;

      async function worker() {
        while (alive) {
          const idx = i++;
          if (idx >= queue.length) break;
          const w = queue[idx];
          const metaInput = resolveMetaInput(w);
          const json = await fetchWalrusMetadata(metaInput);
          if (!alive || !json) continue;

          const preview: MetaPreview = {
            title: String(json?.name || json?.title || "").trim(),
            image: resolveCoverFromMeta(json, w),
            duration:
              json?.duration ??
              json?.length ??
              json?.properties?.duration ??
              json?.properties?.length ??
              json?.properties?.file?.duration,
            category: String(json?.category || json?.properties?.category || "").trim(),
            language: String(json?.language || json?.properties?.language || "").trim(),
          };

          if (!alive) return;
          setMetaCache((prev) => ({ ...prev, [w.id]: preview }));

          const patch: Partial<Work> = {};
          if (preview.title && !String(w.title || "").trim()) patch.title = preview.title;
          if (preview.category && !String(w.category || "").trim()) patch.category = preview.category;
          if (preview.language && !String(w.language || "").trim()) patch.language = preview.language;
          const durNum = Number(preview.duration);
          if (Number.isFinite(durNum) && !Number.isFinite(w.durationSec)) {
            patch.durationSec = Math.max(0, Math.floor(durNum));
          }
          if (Object.keys(patch).length) patchWork(w.id, patch);

          setWorkMetadata({
            workId: w.id,
            title: preview.title,
            image: preview.image,
            category: preview.category,
            language: preview.language,
          });
        }
      }

      await Promise.all(Array.from({ length: Math.min(CONC, queue.length) }, () => worker()));
    }

    run();
    return () => {
      alive = false;
    };
  }, [baseList, metaCache]);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of baseList) {
      const meta = metaCache[w.id];
      const raw = String(meta?.category || w.metaCategory || w.category || "").trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!map.has(key)) map.set(key, raw);
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [baseList, metaCache]);

  const languages = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of baseList) {
      const meta = metaCache[w.id];
      const raw = String(meta?.language || w.metaLanguage || w.language || "").trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!map.has(key)) map.set(key, raw);
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [baseList, metaCache]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baseList.filter((w) => {
      if (filter !== "all" && w.sellType !== filter) return false;

      const meta = metaCache[w.id];
      const cat = String(meta?.category || w.metaCategory || w.category || "").trim().toLowerCase();
      const lang = String(meta?.language || w.metaLanguage || w.language || "").trim().toLowerCase();

      if (categoryFilter !== "all" && cat !== categoryFilter) return false;
      if (languageFilter !== "all" && lang !== languageFilter) return false;

      if (!q) return true;
      const title = resolveTitleFromMeta(meta, w).toLowerCase();
      const author = String(w.authorName || "").toLowerCase();
      const wallet = String(w.authorWallet || "").toLowerCase();
      return title.includes(q) || author.includes(q) || wallet.includes(q);
    });
  }, [baseList, metaCache, filter, categoryFilter, languageFilter, search]);

  useEffect(() => {
    let alive = true;
    if (sortKey !== "top" || !canUseWorkVote() || !suiClient) return;

    const ids = filtered
      .map((w) => String(w.id || "").trim())
      .filter(Boolean)
      .slice(0, 60);
    const queue = ids.filter((id) => voteCache[id] == null);

    async function run() {
      const CONC = 6;
      let i = 0;

      async function worker() {
        while (alive) {
          const idx = i++;
          if (idx >= queue.length) break;
          const id = queue[idx];
          const n = await getVoteCountForWork({ suiClient: suiClient as any, workId: id });
          if (!alive) return;
          setVoteCache((prev) => (prev[id] == null ? { ...prev, [id]: n } : prev));
          setWorkVotes(id, n);
          await new Promise((r) => setTimeout(r, 40));
        }
      }

      await Promise.all(Array.from({ length: Math.min(CONC, queue.length) }, () => worker()));
    }

    run();
    return () => {
      alive = false;
    };
  }, [sortKey, filtered, suiClient, voteCache]);

  const list = useMemo(() => {
    const sorted = [...filtered];
    if (sortKey === "newest") {
      sorted.sort((a, b) => getWorkTime(b) - getWorkTime(a));
    } else if (sortKey === "oldest") {
      sorted.sort((a, b) => getWorkTime(a) - getWorkTime(b));
    } else if (sortKey === "title") {
      sorted.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    } else if (sortKey === "royalty") {
      sorted.sort((a, b) => Number(b.royalty || 0) - Number(a.royalty || 0));
    } else if (sortKey === "top") {
      if (canUseWorkVote()) {
        sorted.sort(
          (a, b) =>
            Number(voteCache[b.id] ?? b.votes ?? 0) - Number(voteCache[a.id] ?? a.votes ?? 0)
        );
      } else {
        sorted.sort((a, b) => getWorkTime(b) - getWorkTime(a));
      }
    }
    return sorted;
  }, [filtered, sortKey, voteCache]);

  const hasData = list.length > 0;

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Marketplace</h1>
          <p className={styles.subtitle}>Approved works + NFT ownership realtime</p>
        </div>

        <div className={styles.filters}>
          <input
            className={styles.searchInput}
            placeholder="Search title / author / wallet..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search works"
          />

          {(["all", "exclusive", "license"] as Filter[]).map(f => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.active : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Tất cả" : f === "exclusive" ? "Bán đứt" : "License"}
            </button>
          ))}

          <select
            className={styles.filterSelect}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            aria-label="Filter by language"
          >
            <option value="all">All languages</option>
            {languages.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>

          <select
            className={styles.sortSelect}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label="Sort works"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="title">Title A–Z</option>
            <option value="royalty">Royalty</option>
            <option value="top">Top</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className={styles.empty}>Loading marketplace…</div>
      ) : !hasData ? (
        <div className={styles.empty}>No verified works yet.</div>
      ) : (
        <div className={styles.grid}>
          {list.map(w => (
            <MarketCard key={w.id} work={w} meta={metaCache[w.id]} />
          ))}
        </div>
      )}
    </main>
  );
}

function MarketCard({ work, meta }: { work: any; meta?: MetaPreview }) {
  // ✅ auto sync owner -> workStore.authorWallet
  const { owner } = useSyncWorkOwner({ workId: work.id, nftObjectId: work.nftObjectId });
  const cover = resolveCoverFromMeta(meta, work);
  const title = resolveTitleFromMeta(meta, work);
  const licenseCount = Array.isArray(work?.licenses) ? work.licenses.length : 0;

  return (
    <div className={styles.card}>
      <div className={styles.cover}>
        {cover ? (
          <img
            className={styles.coverImg}
            src={cover}
            alt={title}
            loading="lazy"
            decoding="async"
          />
        ) : null}
        {!cover ? <div className={styles.coverFallback}>No cover</div> : null}
      </div>
      <div className={styles.badges}>
        <span className={styles.badge}>{work.sellType}</span>
        <span className={styles.badgeSoft}>{work.status}</span>
        {work.featured ? <span className={styles.badgeSoft}>Featured</span> : null}
        {typeof work.votes === "number" ? (
          <span className={styles.badgeSoft}>🔥 {work.votes}</span>
        ) : null}
      </div>

      <h3 className={styles.cardTitle}>{title}</h3>

      <div className={styles.meta}>
        <div>
          <span className={styles.metaLabel}>Owner</span>
          <span className={styles.metaValue}>{shortAddr(owner ?? work.authorWallet)}</span>
        </div>
        {work.sellType === "license" ? (
          <div>
            <span className={styles.metaLabel}>Licenses</span>
            <span className={styles.metaValue}>{licenseCount}</span>
          </div>
        ) : null}

        {work.nftObjectId && (
          <a
            className={styles.metaLink}
            href={explorerObjectUrl(work.nftObjectId)}
            target="_blank"
            rel="noreferrer"
          >
            View NFT
          </a>
        )}
      </div>

      <div className={styles.actions}>
        <Link className={styles.primaryBtn} href={`/marketplace/${work.id}`}>
          Xem chi tiết
        </Link>
      </div>
    </div>
  );
}
