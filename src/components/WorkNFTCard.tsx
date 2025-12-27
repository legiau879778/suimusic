"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type WorkLite = {
  id: string;
  title: string;
  hash?: string; // metadata cid/url
  royalty?: number;
  category?: string;
  language?: string;
  createdDate?: string; // dd/mm/yyyy (optional)
};

function toGateway(input?: string) {
  if (!input) return "";
  let v = String(input).trim();
  if (!v) return "";
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.startsWith("/api/walrus/blob/")) return v;
  if (v.startsWith("walrus:")) return `/api/walrus/blob/${v.slice("walrus:".length)}`;
  if (v.startsWith("walrus://")) return `/api/walrus/blob/${v.slice("walrus://".length)}`;
  return "";
}

function normalizeIpfsUrl(url?: string) {
  return toGateway(url);
}

function pickCover(meta: any) {
  return (
    normalizeIpfsUrl(meta?.properties?.cover?.url) ||
    normalizeIpfsUrl(meta?.image) ||
    normalizeIpfsUrl(meta?.properties?.cover) ||
    normalizeIpfsUrl(meta?.cover) ||
    normalizeIpfsUrl(meta?.animation_url) ||
    ""
  );
}

/** ISO -> dd/mm/yyyy */
function toDDMMYYYY(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function pickCreatedDate(work: WorkLite, meta: any | null) {
  const w = (work.createdDate || "").trim();
  if (w) return w;

  const m1 = (meta?.properties?.createdDate || "").trim();
  if (m1) return m1;

  const mIso = (meta?.properties?.createdAtISO || "").trim();
  if (mIso) return toDDMMYYYY(mIso);

  return "—";
}

/* ===== in-memory cache (shared) ===== */
const META_CACHE = new Map<string, any>();
const META_ERR = new Set<string>();

async function fetchMetadata(metaCidOrUrl: string) {
  const url = toGateway(metaCidOrUrl);
  if (!url) return null;

  if (META_CACHE.has(url)) return META_CACHE.get(url);
  if (META_ERR.has(url)) return null;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("metadata fetch failed");
    const json = await res.json();
    META_CACHE.set(url, json);
    return json;
  } catch {
    META_ERR.add(url);
    return null;
  }
}

export default function WorkNFTCard(props: {
  work: WorkLite;
  href: string; // "/work/[id]" or "/marketplace/[id]"
  chainLabel?: string; // default: "SUI"
  verified?: boolean; // default: true
  className?: string;
  styleModule: {
    card: string;
    cardHead: string;
    cardTitle: string;
    badges: string;
    verifiedBadge: string;
    chainBadge: string;

    preview: string;
    previewImg: string;
    previewEmpty: string;
    nftGrid: string;
    nftGloss: string;
    nftShimmer: string;
    nftHoverCta: string;

    dateBadge: string;

    info: string;
    kv: string;
    k: string;
    v: string;

    metaLink?: string;
  };
}) {
  const { work, href, chainLabel = "SUI", verified = true, className, styleModule: s } = props;

  const [meta, setMeta] = useState<any | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const metaUrl = useMemo(() => toGateway(work.hash), [work.hash]);

  useEffect(() => {
    let alive = true;
    if (!metaUrl) {
      setMeta(null);
      return;
    }

    setLoadingMeta(true);
    fetchMetadata(metaUrl)
      .then((m) => {
        if (alive) setMeta(m);
      })
      .finally(() => {
        if (alive) setLoadingMeta(false);
      });

    return () => {
      alive = false;
    };
  }, [metaUrl]);

  const coverUrl = useMemo(() => (meta ? pickCover(meta) : ""), [meta]);
  const createdText = useMemo(() => pickCreatedDate(work, meta), [work, meta]);

  return (
    <Link href={href} className={`${s.card} ${className || ""}`} aria-label={`View ${work.title}`}>
      <div className={s.cardHead}>
        <div className={s.cardTitle} title={work.title}>
          {work.title}
        </div>

        <div className={s.badges}>
          {verified ? (
            <span className={s.verifiedBadge}>
              <span aria-hidden>🐶</span> Verified
            </span>
          ) : null}
          <span className={s.chainBadge}>{chainLabel}</span>
        </div>
      </div>

      <div className={s.preview}>
        {loadingMeta ? (
          <div className={s.previewEmpty}>Loading…</div>
        ) : coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={s.previewImg}
            src={coverUrl}
            alt={work.title}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className={s.previewEmpty}>NO COVER</div>
        )}

        {/* grid/noise + gloss */}
        <div className={s.nftGrid} />
        <div className={s.nftGloss} />
        <div className={s.nftShimmer} />

        {/* overlay CTA */}
        <div className={s.nftHoverCta}>Xem chi tiết →</div>

        {/* createdDate pill (reuse class name like manage) */}
        <div className={s.dateBadge} title="Ngày sáng tác">
          {createdText}
        </div>
      </div>

      <div className={s.info}>
        <div className={s.kv}>
          <span className={s.k}>Thể loại</span>
          <span className={s.v}>{work.category || "—"}</span>
        </div>
        <div className={s.kv}>
          <span className={s.k}>Ngôn ngữ</span>
          <span className={s.v}>{work.language || "—"}</span>
        </div>
        <div className={s.kv}>
          <span className={s.k}>Royalty</span>
          <span className={s.v}>
            <b>{work.royalty ?? 0}%</b>
          </span>
        </div>
      </div>
    </Link>
  );
}
