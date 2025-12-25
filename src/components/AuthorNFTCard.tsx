"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/** Work shape tối thiểu để gom theo tác giả */
export type WorkLite = {
  id: string;
  title: string;
  hash?: string; // metadata cid/url
  authorId: string;
  authorName?: string;
  authorPhone?: string;
  authorWallet?: string;
  createdDate?: string; // dd/mm/yyyy
  royalty?: number;
};

type Meta = any;

/* ============ IPFS helpers ============ */

function toGateway(input?: string) {
  if (!input) return "";
  let v = String(input).trim();
  if (!v) return "";

  if (v.startsWith("http://") || v.startsWith("https://")) return v;

  if (v.startsWith("ipfs://")) v = v.slice("ipfs://".length);

  v = v.replace(/^\/+/, "");
  if (v.startsWith("ipfs/")) v = v.slice("ipfs/".length);

  // chặn rác tránh spam gateway
  if (!v.startsWith("Qm") && !v.startsWith("bafy")) return "";

  return `https://gateway.pinata.cloud/ipfs/${v}`;
}

function normalizeIpfsUrl(url?: string) {
  return toGateway(url);
}

/** ưu tiên cover theo chuẩn NFT + field custom */
function pickCover(meta: Meta) {
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

function pickCreatedDate(work?: WorkLite, meta?: Meta | null) {
  const w = (work?.createdDate || "").trim();
  if (w) return w;

  const m1 = (meta?.properties?.createdDate || "").trim();
  if (m1) return m1;

  const mIso = (meta?.properties?.createdAtISO || "").trim();
  if (mIso) return toDDMMYYYY(mIso);

  return "—";
}

function shortAddr(a?: string) {
  if (!a) return "—";
  const s = String(a);
  if (s.length <= 12) return s;
  return s.slice(0, 6) + "…" + s.slice(-4);
}

/* ============ in-memory metadata cache ============ */
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

/* ============ Component ============ */

export default function AuthorNFTCard(props: {
  authorId: string;
  authorName?: string;
  authorWallet?: string;
  authorPhone?: string;

  works: WorkLite[]; // list works của tác giả
  href: string; // /author/[id]

  verified?: boolean;
  chainLabel?: string; // "SUI"

  styles: {
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

    authorSub: string;
    authorLine: string;
    authorIcon: string;
  };
}) {
  const {
    authorId,
    authorName,
    authorWallet,
    authorPhone,
    works,
    href,
    verified = true,
    chainLabel = "SUI",
    styles: s,
  } = props;

  // lấy 1 work đại diện (ưu tiên work mới nhất nếu bạn có createdDate)
  // hiện tại: lấy work đầu tiên
  const representative = works[0];

  const metaUrl = useMemo(() => toGateway(representative?.hash), [representative?.hash]);

  const [meta, setMeta] = useState<any | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  useEffect(() => {
    let alive = true;

    if (!metaUrl) {
      setMeta(null);
      return;
    }

    setLoadingMeta(true);
    fetchMetadata(metaUrl)
      .then((m) => alive && setMeta(m))
      .finally(() => alive && setLoadingMeta(false));

    return () => {
      alive = false;
    };
  }, [metaUrl]);

  const coverUrl = useMemo(() => (meta ? pickCover(meta) : ""), [meta]);
  const createdText = useMemo(() => pickCreatedDate(representative, meta), [representative, meta]);

  // stats
  const worksCount = works.length;

  // license count: nếu Work có field licenses[] thì bạn map vào đây.
  // hiện tại fallback 0 để UI sẵn sàng.
  const licenseCount = useMemo(() => {
    let sum = 0;
    for (const w of works as any[]) {
      if (Array.isArray(w?.licenses)) sum += w.licenses.length;
    }
    return sum;
  }, [works]);

  const displayName = authorName?.trim() || `Author ${shortAddr(authorId)}`;
  const sub = authorWallet ? shortAddr(authorWallet) : shortAddr(authorId);

  return (
    <Link href={href} className={s.card} aria-label={`View author ${displayName}`}>
      <div className={s.cardHead}>
        <div>
          <div className={s.cardTitle} title={displayName}>
            {displayName}
          </div>

          <div className={s.authorSub}>
            <div className={s.authorLine}>
              <span className={s.authorIcon}>🪪</span>
              <span>{sub}</span>
            </div>

            {authorPhone ? (
              <div className={s.authorLine}>
                <span className={s.authorIcon}>📞</span>
                <span>{authorPhone}</span>
              </div>
            ) : null}
          </div>
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
          <img className={s.previewImg} src={coverUrl} alt={displayName} />
        ) : (
          <div className={s.previewEmpty}>NO AVATAR</div>
        )}

        {/* grid/noise + gloss + shimmer */}
        <div className={s.nftGrid} />
        <div className={s.nftGloss} />
        <div className={s.nftShimmer} />

        {/* hover CTA */}
        <div className={s.nftHoverCta}>Xem hồ sơ →</div>

        {/* createdDate pill (reuse name like manage) */}
        <div className={s.dateBadge} title="Ngày tác phẩm đại diện">
          {createdText}
        </div>
      </div>

      <div className={s.info}>
        <div className={s.kv}>
          <span className={s.k}>Tác phẩm</span>
          <span className={s.v}>
            <b>{worksCount}</b>
          </span>
        </div>

        <div className={s.kv}>
          <span className={s.k}>License</span>
          <span className={s.v}>
            <b>{licenseCount}</b>
          </span>
        </div>

        <div className={s.kv}>
          <span className={s.k}>Royalty</span>
          <span className={s.v}>
            <b>{representative?.royalty ?? 0}%</b>
          </span>
        </div>
      </div>
    </Link>
  );
}
