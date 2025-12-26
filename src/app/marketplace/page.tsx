"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getVerifiedWorks,
  patchWork,
  syncWorksFromChain,
  type Work,
} from "@/lib/workStore";
import { toGateway } from "@/lib/profileStore";
import { useSyncWorkOwner } from "@/hooks/useSyncWorkOwner";
import { explorerObjectUrl, shortAddr } from "@/lib/suiExplorer";
import styles from "./marketplace.module.css";

type Filter = "all" | "exclusive" | "license";
type SortKey = "newest" | "oldest" | "title" | "royalty";

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
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [list, setList] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [metaCache, setMetaCache] = useState<Record<string, MetaPreview>>({});

  function load() {
    const works = getVerifiedWorks();
    const filtered =
      filter === "all" ? works : works.filter(w => w.sellType === filter);
    const sorted = [...filtered];
    if (sortKey === "newest") {
      sorted.sort((a, b) => getWorkTime(b) - getWorkTime(a));
    } else if (sortKey === "oldest") {
      sorted.sort((a, b) => getWorkTime(a) - getWorkTime(b));
    } else if (sortKey === "title") {
      sorted.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    } else if (sortKey === "royalty") {
      sorted.sort((a, b) => Number(b.royalty || 0) - Number(a.royalty || 0));
    }
    setList(sorted);
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
  }, [filter, sortKey]);

  useEffect(() => {
    let alive = true;
    const queue = list.slice(0, 24).filter((w) => w?.id && !metaCache[w.id]);

    async function run() {
      for (const w of queue) {
        if (!alive) return;
        const metaInput = resolveMetaInput(w);
        const metaUrl = toGateway(metaInput);
        if (!metaUrl) continue;
        try {
          const res = await fetch(metaUrl, { cache: "force-cache" });
          if (!res.ok) continue;
          const json = await res.json();
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
        } catch {
          // ignore
        }
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [list, metaCache]);

  const hasData = list.length > 0;

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Marketplace</h1>
          <p className={styles.subtitle}>Approved works + NFT ownership realtime</p>
        </div>

        <div className={styles.filters}>
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
            className={styles.sortSelect}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label="Sort works"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="title">Title A–Z</option>
            <option value="royalty">Royalty</option>
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

  return (
    <div className={styles.card}>
      <div className={styles.cover}>
        {cover ? <img className={styles.coverImg} src={cover} alt={title} /> : null}
        {!cover ? <div className={styles.coverFallback}>No cover</div> : null}
      </div>
      <div className={styles.badges}>
        <span className={styles.badge}>{work.sellType}</span>
        <span className={styles.badgeSoft}>{work.status}</span>
      </div>

      <h3 className={styles.cardTitle}>{title}</h3>

      <div className={styles.meta}>
        <div>
          <span className={styles.metaLabel}>Owner</span>
          <span className={styles.metaValue}>{shortAddr(owner ?? work.authorWallet)}</span>
        </div>

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
