"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type WorkLite = {
  id: string;
  title: string;
  hash?: string; // metadata cid/url
  walrusMetaId?: string;
  metadataCid?: string;
  metadata?: string;
  walrusCoverId?: string;
  metaImage?: string;
  metaCategory?: string;
  metaLanguage?: string;
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
    normalizeIpfsUrl(meta?.cover_image) ||
    normalizeIpfsUrl(meta?.properties?.cover_image) ||
    normalizeIpfsUrl(meta?.properties?.image) ||
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

function normalizeWalrusId(v: string) {
  const raw = String(v || "").trim();
  if (!raw) return "";
  if (raw.startsWith("0x") && /^[0-9a-fA-F]{64}$/.test(raw.slice(2))) {
    return raw.slice(2);
  }
  return raw;
}

function resolveMetaInput(work: WorkLite) {
  const raw = String(
    work?.walrusMetaId || work?.metadataCid || work?.metadata || work?.hash || ""
  ).trim();
  if (!raw) return "";
  const clean = normalizeWalrusId(raw);
  if (
    clean.startsWith("http://") ||
    clean.startsWith("https://") ||
    clean.startsWith("walrus:") ||
    clean.startsWith("walrus://") ||
    clean.startsWith("/api/walrus/blob/")
  ) {
    return clean;
  }
  return `walrus:${clean}`;
}

function pickAttr(meta: any, key: string) {
  const attrs = Array.isArray(meta?.attributes) ? meta.attributes : [];
  const hit = attrs.find(
    (a: any) => String(a?.trait_type || "").trim().toLowerCase() === key
  );
  return String(hit?.value ?? "").trim();
}

function pickCategory(work: WorkLite, meta: any | null) {
  const raw =
    String(work.metaCategory || "").trim() ||
    String(work.category || "").trim() ||
    String(meta?.category || "").trim() ||
    String(meta?.properties?.category || "").trim() ||
    pickAttr(meta, "category");
  return raw || "—";
}

function pickLanguage(work: WorkLite, meta: any | null) {
  const raw =
    String(work.metaLanguage || "").trim() ||
    String(work.language || "").trim() ||
    String(meta?.language || "").trim() ||
    String(meta?.properties?.language || "").trim() ||
    pickAttr(meta, "language");
  return raw || "—";
}

function resolveCover(meta: any | null, work: WorkLite) {
  const byMeta = meta ? pickCover(meta) : "";
  if (byMeta) return byMeta;

  const raw =
    work?.metaImage || (work as any)?.image || (work as any)?.cover || "";
  const byWork = toGateway(raw);
  if (byWork) return byWork;

  const coverId = String(work?.walrusCoverId || "").trim();
  if (coverId) return toGateway(`walrus:${coverId}`);

  return "";
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

  const metaInput = useMemo(() => resolveMetaInput(work), [work]);
  const metaUrl = useMemo(() => toGateway(metaInput), [metaInput]);

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

  const coverUrl = useMemo(() => resolveCover(meta, work), [meta, work]);
  const createdText = useMemo(() => pickCreatedDate(work, meta), [work, meta]);
  const categoryText = useMemo(() => pickCategory(work, meta), [work, meta]);
  const languageText = useMemo(() => pickLanguage(work, meta), [work, meta]);

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
          <span className={s.v}>{categoryText}</span>
        </div>
        <div className={s.kv}>
          <span className={s.k}>Ngôn ngữ</span>
          <span className={s.v}>{languageText}</span>
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
