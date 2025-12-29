"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import styles from "./search.module.css";
import { getWorks, setWorkMetadata, syncWorksFromChain } from "@/lib/workStore";
import { fetchWalrusMetadata } from "@/lib/walrusMetaCache";
import {
  PROFILE_UPDATED_EVENT,
  findProfileByEmail,
  findProfileByWallet,
  loadProfile,
  toGateway,
} from "@/lib/profileStore";
import { buildVoteWorkTx, canUseWorkVote, getVoteCountForWork } from "@/lib/workVoteChain";
import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";

/* ===== Phosphor Icons ===== */
import { MagnifyingGlass, Sparkle, ClockClockwise, ClockCounterClockwise } from "@phosphor-icons/react";

type Work = any;

function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

type MetaPreview = {
  title?: string;
  image?: string;
  category?: string;
  language?: string;
  authorName?: string;
  duration?: number | string;
  properties?: {
    duration?: number | string;
    cover?: {
      url?: string;
    };
    cover_image?: string;
    image?: string;
  };
};

function resolveMetaInput(w: any) {
  const raw = String(
    w?.walrusMetaId || w?.metadataCid || w?.metadata || w?.hash || ""
  ).trim();
  if (!raw) return "";
  const clean =
    raw.startsWith("0x") && /^[0-9a-fA-F]{64}$/.test(raw.slice(2)) ? raw.slice(2) : raw;
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

function resolveAuthorDisplayName(authorId?: string, fallback?: string, _tick?: number) {
  const id = String(authorId || "").trim();
  if (!id) return String(fallback || "Unknown");

  let p = loadProfile(id);
  if (!p || Object.keys(p).length === 0) {
    const byWallet = findProfileByWallet(id);
    if (byWallet?.profile) p = byWallet.profile;
  }
  if (!p || Object.keys(p).length === 0) {
    const byEmail = findProfileByEmail(id);
    if (byEmail?.profile) p = byEmail.profile;
  }

  const name = String((p as any)?.name || "").trim();
  return name || String(fallback || id);
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

function formatDuration(sec: number) {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}:${String(r).padStart(2, "0")}`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}:${String(mm).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export default function SearchPage() {
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();
  const [works, setWorks] = useState<Work[]>([]);

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const debouncedQ = useDebounce(q);
  const [metaCache, setMetaCache] = useState<Record<string, MetaPreview>>({});
  const [voteCache, setVoteCache] = useState<Record<string, number>>({});
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [votingId, setVotingId] = useState<string | null>(null);
  const [profileTick, setProfileTick] = useState(0);
  const [deletedMap, setDeletedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;

    async function loadWorks() {
      const local = (getWorks() as unknown as Work[]) || [];
      if (alive) setWorks(local);
      await syncWorksFromChain({ force: local.length === 0 });
      if (!alive) return;
      setWorks((getWorks() as unknown as Work[]) || []);
    }

    loadWorks();
    const onUpdate = () => {
      setWorks((getWorks() as unknown as Work[]) || []);
    };
    window.addEventListener("works_updated", onUpdate);
    return () => {
      alive = false;
      window.removeEventListener("works_updated", onUpdate);
    };
  }, []);

  useEffect(() => {
    const ref = collection(db, "works");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const next: Record<string, boolean> = {};
        snap.forEach((docSnap) => {
          const data: any = docSnap.data();
          if (data?.deletedAt) {
            next[docSnap.id.toLowerCase()] = true;
          }
        });
        setDeletedMap(next);
      },
      () => setDeletedMap({})
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const onProfile = () => setProfileTick((x) => x + 1);
    window.addEventListener(PROFILE_UPDATED_EVENT, onProfile as EventListener);
    return () =>
      window.removeEventListener(PROFILE_UPDATED_EVENT, onProfile as EventListener);
  }, []);

  useEffect(() => {
    let alive = true;
    const queue = works.slice(0, 60).filter((w) => w?.id && !metaCache[w.id]);

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
            category: String(
              json?.category || json?.properties?.category || pickAttr(json, "category") || ""
            ).trim(),
            language: String(
              json?.language || json?.properties?.language || pickAttr(json, "language") || ""
            ).trim(),
            authorName: String(
              json?.properties?.author?.name ||
                json?.author ||
                json?.properties?.author_name ||
                ""
            ).trim(),
          };

          if (!alive) return;
          setMetaCache((prev) => ({ ...prev, [w.id]: preview }));

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
  }, [works, metaCache]);

  const filtered = useMemo(() => {
    const k = debouncedQ.trim().toLowerCase();
    return works.filter((w) => {
      if (String(w.status || "") !== "verified") return false;
      const nftId = String(w.nftObjectId || "").toLowerCase();
      if (nftId && deletedMap[nftId]) return false;
      const meta = metaCache[w.id];
      const title = resolveTitleFromMeta(meta, w).toLowerCase();
      const authorMeta = String(meta?.authorName || "").trim();
      const author = (authorMeta || resolveAuthorDisplayName(w.authorId, w.authorName || w.authorWallet, profileTick)).toLowerCase();
      const wallet = String(w.authorWallet || "").toLowerCase();
      const category = String(meta?.category || w.metaCategory || w.category || "").toLowerCase();
      const language = String(meta?.language || w.metaLanguage || w.language || "").toLowerCase();
      if (categoryFilter !== "all" && category !== categoryFilter) return false;
      if (languageFilter !== "all" && language !== languageFilter) return false;
      if (!k) return true;
      return (
        title.includes(k) ||
        author.includes(k) ||
        wallet.includes(k) ||
        category.includes(k) ||
        language.includes(k)
      );
    });
  }, [works, debouncedQ, metaCache, categoryFilter, languageFilter, profileTick, deletedMap]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 160);
    return () => clearTimeout(t);
  }, [debouncedQ]);

  useEffect(() => {
    let alive = true;
    if (!canUseWorkVote() || !suiClient) return;
    const ids = filtered
      .map((w) => String(w.id || "").trim())
      .filter(Boolean)
      .slice(0, 40);
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
          await new Promise((r) => setTimeout(r, 40));
        }
      }

      await Promise.all(Array.from({ length: Math.min(CONC, queue.length) }, () => worker()));
    }

    run();
    return () => {
      alive = false;
    };
  }, [filtered, voteCache, suiClient]);

  const featured = useMemo(() => {
    const featuredList = filtered.filter((w) => w.featured);
    const list = featuredList.length ? featuredList : [...filtered];
    if (canUseWorkVote()) {
      list.sort(
        (a, b) => Number(voteCache[b.id] ?? b.votes ?? 0) - Number(voteCache[a.id] ?? a.votes ?? 0)
      );
    } else {
      list.sort((a, b) => getWorkTime(b) - getWorkTime(a));
    }
    return list.slice(0, 8);
  }, [filtered, voteCache]);

  const newest = useMemo(() => {
    return [...filtered].sort((a, b) => getWorkTime(b) - getWorkTime(a)).slice(0, 8);
  }, [filtered]);

  const oldest = useMemo(() => {
    return [...filtered].sort((a, b) => getWorkTime(a) - getWorkTime(b)).slice(0, 8);
  }, [filtered]);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of works) {
      const meta = metaCache[w.id];
      const raw = String(meta?.category || w.metaCategory || w.category || "").trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!map.has(key)) map.set(key, raw);
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [works, metaCache]);

  const languages = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of works) {
      const meta = metaCache[w.id];
      const raw = String(meta?.language || w.metaLanguage || w.language || "").trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!map.has(key)) map.set(key, raw);
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [works, metaCache]);

  async function handleVote(workId: string) {
    if (!suiClient) return;
    setVotingId(workId);
    try {
      const tx = buildVoteWorkTx(workId);
      await signAndExecuteTransaction({ transaction: tx });
      const n = await getVoteCountForWork({ suiClient: suiClient as any, workId });
      setVoteCache((prev) => ({ ...prev, [workId]: n }));
    } catch {
      // ignore
    } finally {
      setVotingId((prev) => (prev === workId ? null : prev));
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.top}>
          <div>
            <h1 className={styles.h1}>Search works</h1>
            <p className={styles.hint}>
              Featured, newest, and oldest works from on-chain + Walrus metadata.
            </p>
          </div>
          <div className={styles.walletPill} data-on={!!canUseWorkVote()}>
            {canUseWorkVote() ? "Top by votes" : "Top by newest"}
          </div>
        </section>

        <section className={styles.searchBar}>
          <div className={styles.searchInputWrap}>
            <MagnifyingGlass size={18} weight="bold" className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search by title / author / wallet / category / language…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className={styles.filters}>
            <div className={styles.filter}>
              <select
                className={styles.select}
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
            </div>
            <div className={styles.filter}>
              <select
                className={styles.select}
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
            </div>
          </div>
        </section>

        {loading ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>⏳</div>
            <p>Loading works…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🔍</div>
            <p>No works found</p>
          </div>
        ) : (
          <>
            <WorkBlock
              title="Featured works"
              subtitle={canUseWorkVote() ? "Ranked by votes" : "Ranked by time"}
              icon={<Sparkle size={16} weight="fill" />}
              works={featured}
              metaCache={metaCache}
              voteCache={voteCache}
              onVote={canUseWorkVote() ? handleVote : undefined}
              votingId={votingId}
              votingDisabled={isPending}
              profileTick={profileTick}
            />
            <WorkBlock
              title="Newest works"
              subtitle="Sorted by most recent"
              icon={<ClockClockwise size={16} weight="fill" />}
              works={newest}
              metaCache={metaCache}
              onVote={canUseWorkVote() ? handleVote : undefined}
              votingId={votingId}
              votingDisabled={isPending}
              profileTick={profileTick}
            />
            <WorkBlock
              title="Oldest works"
              subtitle="Sorted by oldest"
              icon={<ClockCounterClockwise size={16} weight="fill" />}
              works={oldest}
              metaCache={metaCache}
              onVote={canUseWorkVote() ? handleVote : undefined}
              votingId={votingId}
              votingDisabled={isPending}
              profileTick={profileTick}
            />
          </>
        )}
      </div>
    </main>
  );
}

function WorkBlock({
  title,
  subtitle,
  icon,
  works,
  metaCache,
  voteCache,
  onVote,
  votingId,
  votingDisabled,
  profileTick,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  works: Work[];
  metaCache: Record<string, MetaPreview>;
  voteCache?: Record<string, number>;
  onVote?: (workId: string) => void;
  votingId?: string | null;
  votingDisabled?: boolean;
  profileTick: number;
}) {
  return (
    <section className={styles.block}>
      <div className={styles.blockHead}>
        <div>
          <h2 className={styles.blockTitle}>
            {icon} {title}
          </h2>
          <p className={styles.blockSub}>{subtitle}</p>
        </div>
      </div>

      <div className={styles.grid8}>
        {works.map((w) => {
          const meta = metaCache[w.id];
          const cover = resolveCoverFromMeta(meta, w);
          const titleText = resolveTitleFromMeta(meta, w);
          const authorText =
            String(meta?.authorName || "").trim() ||
            resolveAuthorDisplayName(w.authorId, w.authorName || w.authorWallet, profileTick);
          const categoryText =
            String(meta?.category || w.metaCategory || w.category || "").trim() || "Uncategorized";
          const languageText =
            String(meta?.language || w.metaLanguage || w.language || "").trim() || "—";
          const rawDuration =
            Number(meta?.duration || meta?.properties?.duration || w.durationSec || 0) || 0;
          const vote = voteCache
            ? Number(voteCache[w.id] ?? w.votes ?? 0)
            : Number(w.votes ?? 0) || null;
          return (
            <div key={w.id} className={styles.card}>
              <Link className={styles.cardLink} href={`/work/${w.id}`}>
                <div className={styles.cover}>
                  {cover ? (
                    <img
                      className={styles.coverImg}
                      src={cover}
                      alt={titleText}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className={styles.coverFallback}>No cover</div>
                  )}
                  <div className={styles.chips}>
                    <span className={styles.chip}>{String(w.sellType || "").toUpperCase()}</span>
                    {vote != null ? <span className={styles.chip}>🔥 {vote}</span> : null}
                    {w.featured ? <span className={styles.chip}>Featured</span> : null}
                  </div>
                </div>

                <div className={styles.body}>
                  <div className={styles.titleRow}>
                    <h3 className={styles.cardTitle}>{titleText}</h3>
                  </div>

                  <div className={styles.metaLine}>
                    <span className={styles.metaItem}>
                      {categoryText}
                    </span>
                    <span className={styles.dot}>•</span>
                    <span className={styles.metaItem}>
                      {languageText}
                    </span>
                    <span className={styles.dot}>•</span>
                    <span className={styles.metaItem}>
                      {formatDuration(rawDuration)}
                    </span>
                  </div>

                  <div className={styles.authorLine}>
                    <span className={styles.authorName}>
                      {authorText}
                    </span>
                  </div>
                </div>
              </Link>
              {onVote ? (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.voteBtn}
                    onClick={() => onVote(w.id)}
                    disabled={votingDisabled || votingId === w.id}
                  >
                    {votingId === w.id ? "Voting..." : "Like"}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
