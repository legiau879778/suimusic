"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./search.module.css";

import { getVerifiedWorks, syncWorksFromChain, type Work } from "@/lib/workStore";
import { loadProfile, toGateway } from "@/lib/profileStore";

/* ===== SUI ===== */
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";

/* ===== chain vote helpers ===== */
import { WORK_VOTE, canUseWorkVote, getVoteCountForWork } from "@/lib/workVoteChain";

/* ===== Icons ===== */
import {
  MagnifyingGlass,
  FunnelSimple,
  ArrowLeft,
  ArrowRight,
  Sparkle,
  Clock,
  Tag,
  Translate,
  ThumbsUp,
} from "@phosphor-icons/react";

type MetaPreview = {
  title?: string;
  description?: string;
  image?: string;
  duration?: string | number;
  category?: string;
  language?: string;
  authorName?: string;
};

function safeText(v: any, fallback = "—") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}

function formatDurationAuto(input: any): string {
  if (input == null) return "—";
  if (typeof input === "string") {
    const s = input.trim();
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return s;
    if (/^\d+$/.test(s)) return formatDurationAuto(Number(s));
  }
  if (typeof input === "number" && Number.isFinite(input)) {
    const sec = Math.max(0, Math.floor(input));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    if (h > 0) return `${h}:${mm}:${ss}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return "—";
}

function useDebounce<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
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

function resolveCover(w: any): string {
  const raw =
    (w?.cover || "").trim() ||
    (w?.coverUrl || "").trim() ||
    (w?.image || "").trim() ||
    (w?.metadata?.image || "").trim();
  if (raw) return toGateway(raw);

  const walrusCoverId = String(w?.walrusCoverId || "").trim();
  if (walrusCoverId) return toGateway(`walrus:${walrusCoverId}`);

  return "";
}

function resolveMetaCid(w: any): string {
  const raw =
    (w?.walrusMetaId || "").trim() ||
    (w?.metadataCid || "").trim() ||
    (w?.metadata || "").trim() ||
    (w?.ipfsMeta || "").trim() ||
    (w?.hash || "").trim();
  return raw;
}

function resolveTitle(w: any): string {
  return safeText(w?.title, "Untitled");
}

function looksLikeId(v: string) {
  if (!v) return false;
  if (v.startsWith("0x") && v.length > 12) return true;
  if (/^\d{8,}$/.test(v)) return true;
  if (v.length >= 24) return true;
  return false;
}

function looksLikeEmail(v: string) {
  return /.+@.+\..+/.test(v);
}

function sanitizeAuthorName(name?: string) {
  const n = String(name || "").trim();
  if (!n) return "Unknown";
  if (looksLikeId(n) || looksLikeEmail(n)) return "Unknown";
  return n;
}

function resolveAuthorName(w: any): string {
  const authorId = String(w?.authorId || "").trim();
  const p = authorId ? loadProfile(authorId) : {};
  return sanitizeAuthorName(p?.name || w?.authorName || "");
}

function guessKindFromFile(meta: any): "image" | "audio" | "video" | "pdf" | "other" {
  const t: string =
    meta?.file?.mime ||
    meta?.file?.type ||
    meta?.properties?.file?.type ||
    meta?.properties?.cover?.type ||
    meta?.mimeType ||
    "";

  const name: string =
    meta?.file?.name ||
    meta?.properties?.file?.name ||
    meta?.properties?.cover?.name ||
    meta?.name ||
    "";

  const lowerT = (t || "").toLowerCase();
  const lowerName = (name || "").toLowerCase();

  if (lowerT.startsWith("image/")) return "image";
  if (lowerT.startsWith("audio/")) return "audio";
  if (lowerT.startsWith("video/")) return "video";
  if (lowerT.includes("pdf")) return "pdf";

  if (/\.(png|jpg|jpeg|webp|gif|bmp|svg)$/.test(lowerName)) return "image";
  if (/\.(mp3|wav|ogg|m4a|flac)$/.test(lowerName)) return "audio";
  if (/\.(mp4|webm|mov|mkv)$/.test(lowerName)) return "video";
  if (/\.(pdf)$/.test(lowerName)) return "pdf";

  return "other";
}

function statusLabel(s?: string) {
  if (s === "verified") return "Verified";
  if (s === "pending") return "Pending";
  if (s === "rejected") return "Rejected";
  return "—";
}

function sellTypeLabel(t?: string) {
  if (t === "exclusive") return "Exclusive";
  if (t === "license") return "License";
  if (t === "none") return "Not for sale";
  return t || "—";
}

/** ====== Carousel ====== */
function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function SearchPage() {
  const [works, setWorks] = useState<Work[]>([]);
  const [detailWork, setDetailWork] = useState<Work | null>(null);

  useEffect(() => {
    const load = () => {
      const list = (getVerifiedWorks() as unknown as Work[]) || [];
      setWorks(list);
    };

    syncWorksFromChain();
    load();
    const onUpdate = () => load();
    window.addEventListener("works_updated", onUpdate);
    return () => window.removeEventListener("works_updated", onUpdate);
  }, []);

  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q);

  const [category, setCategory] = useState("all");
  const [language, setLanguage] = useState("all");

  // hover metadata cache
  const [metaCache, setMetaCache] = useState<Record<string, MetaPreview>>({});
  const [metaOpenId, setMetaOpenId] = useState<string | null>(null);
  const metaTimer = useRef<any>(null);

  // chain votes (workId -> count)
  const [voteMap, setVoteMap] = useState<Record<string, number>>({});
  const voteMapRef = useRef(voteMap);
  useEffect(() => {
    voteMapRef.current = voteMap;
  }, [voteMap]);

  // vote on-chain
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [votingWorkId, setVotingWorkId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const w of works) {
      const c = String((w as any)?.category || "").trim();
      if (c) set.add(c);
    }
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [works]);

  const languages = useMemo(() => {
    const set = new Set<string>();
    for (const w of works) {
      const l = String((w as any)?.language || "").trim();
      if (l) set.add(l);
    }
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [works]);

  const filtered = useMemo(() => {
    const k = debouncedQ.trim().toLowerCase();
    return works.filter((w: any) => {
      if (category !== "all" && String(w?.category || "") !== category) return false;
      if (language !== "all" && String(w?.language || "") !== language) return false;

      if (!k) return true;

      const title = String(w?.title || "").toLowerCase();
      const author = resolveAuthorName(w).toLowerCase();
      const cat = String(w?.category || "").toLowerCase();
      const lang = String(w?.language || "").toLowerCase();

      return title.includes(k) || author.includes(k) || cat.includes(k) || lang.includes(k);
    });
  }, [works, debouncedQ, category, language]);

  /** Fetch on-chain votes for the filtered list (limited for speed) */
  useEffect(() => {
    let alive = true;

    async function run() {
      if (!canUseWorkVote()) return;

      // limit to avoid spamming RPC: max 120 works in filtered
      const list = filtered.slice(0, 120);
      const ids = list.map((w: any) => String(w?.id || "").trim()).filter(Boolean);

      // fetch ids not in voteMap yet
      const missing = ids.filter((id) => voteMapRef.current[id] === undefined);
      if (missing.length === 0) return;

      // light concurrency
      const CONC = 6;
      let i = 0;
      const nextMap: Record<string, number> = {};

      async function worker() {
        while (alive) {
          const idx = i++;
          if (idx >= missing.length) break;
          const id = missing[idx];

          const n = await getVoteCountForWork({ suiClient: suiClient as any, workId: id });
          if (!alive) return;
          nextMap[id] = n;

          // small delay for RPC
          await new Promise((r) => setTimeout(r, 40));
        }
      }

      await Promise.all(Array.from({ length: Math.min(CONC, missing.length) }, () => worker()));
      if (!alive) return;

      // merge into state
      setVoteMap((prev) => ({ ...prev, ...nextMap }));
    }

    run();
    return () => {
      alive = false;
    };
  }, [filtered, suiClient]);

  /** Featured: sort by on-chain votes (workId) desc, tie-break by newest */
  const featured = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a: any, b: any) => {
      const av = Number(voteMap[a?.id] ?? 0);
      const bv = Number(voteMap[b?.id] ?? 0);
      if (bv !== av) return bv - av;
      return getWorkTime(b) - getWorkTime(a);
    });
    return arr;
  }, [filtered, voteMap]);

  const newest = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a: any, b: any) => getWorkTime(b) - getWorkTime(a));
    return arr;
  }, [filtered]);

  // carousel pages: 8 items/page (2 rows x 4)
  const featuredPages = useMemo(() => chunk(featured, 8), [featured]);
  const newestPages = useMemo(() => chunk(newest, 8), [newest]);

  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [newestIdx, setNewestIdx] = useState(0);

  useEffect(() => {
    setFeaturedIdx(0);
    setNewestIdx(0);
  }, [debouncedQ, category, language]);

  useEffect(() => {
    let alive = true;
    const queue: Array<{ id: string; w: any }> = [];

    const add = (w: any) => {
      const id = String(w?.id || "").trim();
      if (!id || metaCache[id]) return;
      const baseAuthor = resolveAuthorName(w);
      const need =
        !resolveCover(w) ||
        !baseAuthor ||
        formatDurationAuto(
          (w as any)?.durationSec ??
            (w as any)?.duration ??
            (w as any)?.length ??
            (w as any)?.metaDuration
        ) === "—";
      if (need) queue.push({ id, w });
    };

    (featuredPages[featuredIdx] || []).forEach(add);
    (newestPages[newestIdx] || []).forEach(add);

    const run = async () => {
      for (const item of queue) {
        if (!alive) return;
        await fetchMetaPreview(item.id, item.w);
        await new Promise((r) => setTimeout(r, 40));
      }
    };
    run();

    return () => {
      alive = false;
    };
  }, [featuredIdx, newestIdx, featuredPages, newestPages, metaCache]);

  async function fetchMetaPreview(workId: string, w: any) {
    if (metaCache[workId]) return;

    const metaCid = resolveMetaCid(w);
    if (!metaCid) return;

    const url = toGateway(metaCid);
    if (!url) return;

    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) return;
      const json = (await res.json()) as any;

      const preview: MetaPreview = {
        title: json?.title || w?.title,
        description: json?.description || json?.desc,
        image: toGateway(
          json?.image ||
            json?.cover ||
            json?.properties?.cover?.url ||
            json?.properties?.cover_image ||
            ""
        ),
        duration:
          json?.duration ??
          json?.length ??
          json?.properties?.duration ??
          json?.properties?.length ??
          json?.properties?.file?.duration ??
          (w as any)?.duration,
        category: json?.category || (w as any)?.category,
        language: json?.language || (w as any)?.language,
        authorName:
          json?.authorName ||
          json?.properties?.author?.name ||
          json?.author?.name ||
          resolveAuthorName(w),
      };

      setMetaCache((prev) => ({ ...prev, [workId]: preview }));
    } catch {
      // ignore
    }
  }

  function openDetail(w: Work) {
    setDetailWork(w);
  }

  function closeDetail() {
    setDetailWork(null);
  }

  function onHoverCard(workId: string, w: any, sectionKey: string) {
    if (metaTimer.current) clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(() => {
      setMetaOpenId(`${sectionKey}:${workId}`);
      fetchMetaPreview(workId, w);
    }, 120);
  }

  function onLeaveCard() {
    if (metaTimer.current) clearTimeout(metaTimer.current);
    setMetaOpenId(null);
  }

  async function voteWork(workId: string) {
    if (!account?.address) return;
    if (!canUseWorkVote()) {
      alert("NEXT_PUBLIC_WORK_VOTE_PACKAGE_ID / BOARD_ID not configured");
      return;
    }

    const wid = String(workId || "").trim();
    if (!wid) return;

    setVotingWorkId(wid);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${WORK_VOTE.PACKAGE_ID}::${WORK_VOTE.MODULE}::${WORK_VOTE.VOTE_FN}`,
        arguments: [tx.object(WORK_VOTE.BOARD_ID), tx.pure.string(wid)],
      });

      const result = await signAndExecute({ transaction: tx });

      // Optimistic update: +1 immediately for sorting
      setVoteMap((prev) => ({ ...prev, [wid]: Number(prev[wid] ?? 0) + 1 }));

      // (optional) confirm and re-fetch the exact count
      try {
        await (suiClient as any).waitForTransaction({ digest: result.digest });
        const truth = await getVoteCountForWork({ suiClient: suiClient as any, workId: wid });
        setVoteMap((prev) => ({ ...prev, [wid]: truth }));
      } catch {}
    } catch (e: any) {
      const msg = String(e?.message || e || "");
      alert(msg.includes("E_ALREADY_VOTED") ? "You already voted for this work." : "Vote failed.");
    } finally {
      setVotingWorkId(null);
    }
  }

  function WorkCard({ w, sectionKey }: { w: any; sectionKey: string }) {
    const workId = String(w?.id || "");
    const title = resolveTitle(w);
    const metaCover = metaCache[workId]?.image;
    const cover = resolveCover(w) || (metaCover ? toGateway(metaCover) : "");
    const metaDuration = metaCache[workId]?.duration;
    const duration = formatDurationAuto(
      metaDuration ??
        (w as any)?.durationSec ??
        (w as any)?.duration ??
        (w as any)?.length ??
        (w as any)?.metaDuration
    );
    const cat = safeText((w as any)?.category);
    const lang = safeText((w as any)?.language);
    const baseAuthor = resolveAuthorName(w);
    const metaAuthor = metaCache[workId]?.authorName;
    const authorName = sanitizeAuthorName(metaAuthor || baseAuthor);

    const votes = Number(voteMap[workId] ?? 0);

    const hoverMeta = workId ? metaCache[workId] : undefined;
    const showMeta = metaOpenId === `${sectionKey}:${workId}` && !!hoverMeta;

    return (
      <div
        className={styles.card}
        onClick={() => openDetail(w)}
        onMouseEnter={() => onHoverCard(workId, w, sectionKey)}
        onMouseLeave={onLeaveCard}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") openDetail(w);
        }}
      >
        <div className={styles.cardLink}>
          <div className={styles.cover}>
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.coverImg} src={cover} alt={title} />
            ) : (
              <div className={styles.coverFallback}>
                <Sparkle size={18} weight="fill" />
                <span>No cover</span>
              </div>
            )}

            <div className={styles.chips}>
              <span className={styles.chip}>
                <Clock size={14} /> {duration}
              </span>
              <span className={styles.chip}>
                <ThumbsUp size={14} weight="fill" /> {votes}
              </span>
            </div>
          </div>

          <div className={styles.body}>
            <div className={styles.titleRow}>
              <h3 className={styles.cardTitle}>{title}</h3>
            </div>

            <div className={styles.metaLine}>
              <span className={styles.metaItem}>
                <Tag size={14} /> {cat}
              </span>
              <span className={styles.dot}>•</span>
              <span className={styles.metaItem}>
                <Translate size={14} /> {lang}
              </span>
            </div>

            <div className={styles.authorLine}>
              <span className={styles.authorName}>{authorName}</span>
            </div>
          </div>
        </div>

        <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
          <button
            className={styles.voteBtn}
            onClick={() => voteWork(workId)}
            disabled={!account?.address || votingWorkId === workId || !workId}
            title={!account?.address ? "Connect wallet to vote" : "Vote for work"}
          >
            <ThumbsUp size={16} weight="fill" />
            {votingWorkId === workId ? "Voting..." : "Vote for work"}
          </button>
        </div>

        {showMeta && (
          <div className={styles.preview}>
            <div className={styles.previewHead}>
              <div className={styles.previewTitle}>{safeText(hoverMeta?.title, title)}</div>
              <div className={styles.previewSub}>
                {safeText(hoverMeta?.authorName, authorName)} • {safeText(hoverMeta?.category, cat)} •{" "}
                {safeText(hoverMeta?.language, lang)}
              </div>
            </div>

            {hoverMeta?.description && (
              <div className={styles.previewDesc}>{String(hoverMeta.description).slice(0, 180)}</div>
            )}

            {hoverMeta?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.previewImg} src={hoverMeta.image} alt="meta preview" />
            )}
          </div>
        )}
      </div>
    );
  }

  function WorkDetailModal({ work }: { work: Work }) {
    const [meta, setMeta] = useState<any | null>(null);
    const [loadingMeta, setLoadingMeta] = useState(false);

    const metaCid = resolveMetaCid(work);
    const metaUrl = metaCid ? toGateway(metaCid) : "";

    useEffect(() => {
      let alive = true;
      async function run() {
        if (!metaUrl) {
          setMeta(null);
          return;
        }
        setLoadingMeta(true);
        try {
          const res = await fetch(metaUrl, { cache: "no-store" });
          if (!res.ok) throw new Error("metadata fetch failed");
          const json = await res.json();
          if (alive) setMeta(json);
        } catch {
          if (alive) setMeta(null);
        } finally {
          if (alive) setLoadingMeta(false);
        }
      }
      run();
      return () => {
        alive = false;
      };
    }, [metaUrl]);

    const coverUrl =
      toGateway(
        meta?.properties?.cover?.url ||
          meta?.cover_image ||
          meta?.cover?.url ||
          meta?.image ||
          ""
      ) || resolveCover(work);

    const mediaUrl = toGateway(
      meta?.animation_url ||
        meta?.file?.url ||
        meta?.properties?.file?.url ||
        ""
    );

    const kind = guessKindFromFile(meta);
    const displayKind = mediaUrl && kind === "other" ? "audio" : kind;
    const duration = formatDurationAuto(
      meta?.duration ??
        meta?.length ??
        meta?.properties?.duration ??
        meta?.properties?.length ??
        meta?.properties?.file?.duration ??
        (work as any)?.durationSec ??
        (work as any)?.duration ??
        (work as any)?.length ??
        (work as any)?.metaDuration
    );

    const authorName = sanitizeAuthorName(
      meta?.authorName ||
        meta?.properties?.author?.name ||
        meta?.author?.name ||
        resolveAuthorName(work)
    );

    return (
      <div className={styles.modalOverlay} onClick={closeDetail} role="presentation">
        <div
          className={styles.modal}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className={styles.modalHeader}>
            <div>
              <div className={styles.modalTitle}>{resolveTitle(work)}</div>
              <div className={styles.modalSub}>
                <span className={styles.modalBadge} data-status={work.status ?? "unknown"}>
                  {statusLabel(work.status)}
                </span>
                <span className={styles.modalBadge}>{sellTypeLabel(work.sellType)}</span>
                <span className={styles.modalDot}>•</span>
                <span className={styles.modalMeta}>{authorName}</span>
              </div>
            </div>
            <button className={styles.closeBtn} onClick={closeDetail} aria-label="Close">
              ✕
            </button>
          </div>

          <div className={styles.modalBody}>
            <div className={styles.modalPreview}>
              {loadingMeta ? (
                <div className={styles.previewLoading}>Loading…</div>
              ) : coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.modalImg} src={coverUrl} alt={resolveTitle(work)} />
              ) : (
                <div className={styles.previewEmpty}>No cover</div>
              )}
            </div>

            <div className={styles.modalGrid}>
              <div className={styles.kv}>
                <div className={styles.k}>Duration</div>
                <div className={styles.v}>{duration}</div>
              </div>
              <div className={styles.kv}>
                <div className={styles.k}>Category</div>
                <div className={styles.v}>{safeText((work as any)?.category)}</div>
              </div>
              <div className={styles.kv}>
                <div className={styles.k}>Language</div>
                <div className={styles.v}>{safeText((work as any)?.language)}</div>
              </div>
              <div className={styles.kv}>
                <div className={styles.k}>Royalty</div>
                <div className={styles.v}>{`${work.royalty ?? 0}%`}</div>
              </div>
              <div className={styles.kv}>
                <div className={styles.k}>NFT</div>
                <div className={styles.vMono}>{work.nftObjectId || "—"}</div>
              </div>
              <div className={styles.kv}>
                <div className={styles.k}>Tx</div>
                <div className={styles.vMono}>{work.txDigest || "—"}</div>
              </div>
              <div className={styles.kv}>
                <div className={styles.k}>Metadata</div>
                <div className={styles.vMono}>{metaUrl || "—"}</div>
              </div>
            </div>
          </div>

          {meta?.description ? (
            <div className={styles.metaDesc}>{String(meta.description)}</div>
          ) : null}

          <div className={styles.mediaBox}>
            <div className={styles.mediaHead}>
              <div className={styles.mediaTitle}>Preview file</div>
              {mediaUrl ? (
                <a className={styles.link} href={mediaUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
              ) : null}
            </div>
            {!mediaUrl ? (
              <div className={styles.mediaEmpty}>
                No preview file (metadata missing animation_url / file.url).
              </div>
            ) : displayKind === "audio" ? (
              <audio className={styles.audio} controls src={mediaUrl} />
            ) : displayKind === "video" ? (
              <video className={styles.video} controls src={mediaUrl} />
            ) : displayKind === "pdf" ? (
              <iframe className={styles.pdf} src={mediaUrl} title="pdf-preview" />
            ) : displayKind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.modalImg} src={mediaUrl} alt="preview" />
            ) : (
              <div className={styles.mediaEmpty}>
                Unable to detect type.{" "}
                <a className={styles.link} href={mediaUrl} target="_blank" rel="noreferrer">
                  Open file
                </a>
              </div>
            )}
          </div>

          <div className={styles.modalActions}>
            <Link
              className={styles.actionLink}
              href={`/marketplace/${encodeURIComponent(String(work.id || ""))}`}
            >
              Open marketplace page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  function CarouselBlock(props: {
    title: string;
    subtitle: string;
    pages: any[][];
    index: number;
    setIndex: (n: number) => void;
    emptyText: string;
  }) {
    const { title, subtitle, pages, index, setIndex, emptyText } = props;
    const max = Math.max(0, pages.length - 1);
    const idx = clamp(index, 0, max);
    const page = pages[idx] || [];

    return (
      <section className={styles.block}>
        <div className={styles.blockHead}>
          <div>
            <h2 className={styles.blockTitle}>{title}</h2>
            <p className={styles.blockSub}>{subtitle}</p>
          </div>

          <div className={styles.navBtns}>
            <button className={styles.navBtn} onClick={() => setIndex(idx - 1)} disabled={idx <= 0} aria-label="Prev">
              <ArrowLeft size={16} weight="bold" />
            </button>
            <button className={styles.navBtn} onClick={() => setIndex(idx + 1)} disabled={idx >= max} aria-label="Next">
              <ArrowRight size={16} weight="bold" />
            </button>
          </div>
        </div>

        {page.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🔎</div>
            <div>{emptyText}</div>
          </div>
        ) : (
          <div className={styles.grid8}>
            {page.map((w: any) => (
              <WorkCard key={String(w?.id)} w={w} sectionKey={title} />
            ))}
          </div>
        )}

        {pages.length > 1 && (
          <div className={styles.dots}>
            {pages.map((_, i) => (
              <button
                key={i}
                className={styles.dotBtn}
                data-active={String(i === idx)}
                onClick={() => setIndex(i)}
                aria-label={`Page ${i + 1}`}
              />
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.top}>
          <div>
            <h1 className={styles.h1}>Search works</h1>
            <p className={styles.hint}>
              Sort "Featured" by <b>on-chain votes</b> (workId). Hover to preview metadata.
            </p>
            {!canUseWorkVote() && (
              <p className={styles.hint} style={{ marginTop: 8 }}>
                ⚠️ WORK_VOTE env not configured -&gt; featured still shows but vote count = 0.
              </p>
            )}
          </div>

          <div className={styles.walletPill} data-on={String(!!account?.address)}>
            {account?.address ? `Wallet: ${account.address.slice(0, 6)}...${account.address.slice(-4)}` : "Wallet not connected"}
          </div>
        </header>

        <section className={styles.searchBar}>
          <div className={styles.searchInputWrap}>
            <MagnifyingGlass size={18} weight="bold" className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search by title / author / category / language..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className={styles.filters}>
            <div className={styles.filter}>
              <FunnelSimple size={16} weight="bold" />
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={styles.select}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === "all" ? "All categories" : c}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filter}>
              <Translate size={16} weight="bold" />
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className={styles.select}>
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {l === "all" ? "All languages" : l}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <CarouselBlock
          title="Featured"
          subtitle="Sorted by on-chain votes (desc), tie-break by newest."
          pages={featuredPages}
          index={featuredIdx}
          setIndex={setFeaturedIdx}
          emptyText="No works found"
        />

        <CarouselBlock
          title="Newest"
          subtitle="Sorted by created/minted/reviewed/verified."
          pages={newestPages}
          index={newestIdx}
          setIndex={setNewestIdx}
          emptyText="No works found"
        />
      </div>
      {detailWork ? <WorkDetailModal work={detailWork} /> : null}
    </main>
  );
}
