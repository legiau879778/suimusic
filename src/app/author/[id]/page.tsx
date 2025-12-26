"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import styles from "./author.module.css";
import { getVerifiedWorks, syncWorksFromChain } from "@/lib/workStore";

/* ✅ profileStore */
import {
  loadProfile,
  subscribeProfile,
  type UserProfile,
  toGateway,
  findProfileByEmail,
  findProfileByWallet,
} from "@/lib/profileStore";

/* ===== Phosphor Icons ===== */
import {
  ArrowLeft,
  ShieldCheck,
  UserCircle,
  Envelope,
  Wallet,
  Phone,
  GlobeHemisphereWest,
  MapPin,
  CalendarBlank,
  MusicNotes,
  Info,
  ArrowRight,
  X,
} from "@phosphor-icons/react";

type Work = any;

/* ===== Helpers ===== */

function shortAddr(a?: string) {
  if (!a) return "—";
  const v = String(a);
  if (v.length <= 12) return v;
  return v.slice(0, 6) + "…" + v.slice(-4);
}

function toDDMMYYYY(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function pickCreatedDate(work: Work, meta: any | null) {
  const w = String(work?.createdDate || "").trim();
  if (w) return w;

  const m1 = String(meta?.properties?.createdDate || "").trim();
  if (m1) return m1;

  const mIso = String(meta?.properties?.createdAtISO || "").trim();
  if (mIso) return toDDMMYYYY(mIso);

  return "—";
}

function guessKindFromFile(meta: any): "image" | "audio" | "video" | "pdf" | "other" {
  const t: string =
    meta?.properties?.file?.type ||
    meta?.properties?.cover?.type ||
    meta?.mimeType ||
    "";

  const name: string =
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

/* ===== Metadata cache ===== */
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

/** resolve profile: prefer loadProfile(authorId) -> fallback find by email/wallet from repWork */
function resolveProfile(authorId: string, repWork: Work | null): UserProfile | null {
  const p0 = loadProfile(authorId);

  const hasAny =
    !!String(p0?.email || "").trim() ||
    !!String(p0?.avatar || "").trim() ||
    !!String(p0?.name || "").trim();

  if (hasAny) return p0 || null;

  const rep = repWork || {};
  const repEmail = String(rep.authorEmail || rep.email || "").trim();
  const repWallet = String(rep.authorWallet || rep.walletAddress || "").trim();

  const byEmail = repEmail ? findProfileByEmail(repEmail) : null;
  const byWallet = !byEmail && repWallet ? findProfileByWallet(repWallet) : null;

  return (byEmail?.profile || byWallet?.profile || null) as UserProfile | null;
}

/* ===== Pick author info (prefer profileStore) ===== */
function pickAuthorFromProfile(authorId: string, prof: UserProfile | null, repWork: Work | null) {
  const rep = repWork || {};

  const name = String(prof?.name || "").trim();
  const email = String(prof?.email || "").trim();
  const phone = String(prof?.phone || "").trim();
  const country = String(prof?.country || "").trim();
  const address = String(prof?.address || "").trim();
  const wallet = String(prof?.walletAddress || "").trim();

  const avatar =
    String(prof?.avatar || "").trim() ||
    String((rep.authorAvatar || rep.avatar || "") ?? "").trim();

  return {
    id: authorId,
    name: name || String(rep.authorName || "").trim() || "Author",
    email: email || String(rep.authorEmail || rep.email || "").trim() || "—",
    avatar,
    phone: phone || String(rep.authorPhone || rep.phone || "").trim() || "",
    wallet: wallet || String(rep.authorWallet || rep.walletAddress || "").trim() || "",
    country: country || String(rep.country || "").trim() || "",
    address: address || String(rep.address || "").trim() || "",
  };
}

export default function AuthorProfilePage() {
  const params = useParams();
  const authorId = decodeURIComponent(String(params?.id || ""));

  // FIX hydration: only load localStorage-based data after mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [worksVersion, setWorksVersion] = useState(0);

  useEffect(() => {
    if (!mounted) return;
    syncWorksFromChain();
    const onUpdate = () => setWorksVersion((v) => v + 1);
    window.addEventListener("works_updated", onUpdate);
    return () => window.removeEventListener("works_updated", onUpdate);
  }, [mounted]);

  const worksAll = useMemo(() => {
    if (!mounted) return [] as Work[];
    return getVerifiedWorks() as unknown as Work[];
  }, [mounted, worksVersion]);

  const works = useMemo(() => {
    if (!mounted) return [] as Work[];
    return worksAll.filter((w) => String(w.authorId) === authorId);
  }, [mounted, worksAll, authorId]);

  const repWork = useMemo(() => (works[0] ? works[0] : null), [works]);

  /* ✅ profileStore */
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // stable key to avoid object dependency loops
  const repEmailKey = String(repWork?.authorEmail || repWork?.email || "").trim();
  const repWalletKey = String(repWork?.authorWallet || repWork?.walletAddress || "").trim();

  useEffect(() => {
    if (!mounted) return;
    if (!authorId) return;

    // initial resolve
    setProfile(resolveProfile(authorId, repWork));

    // listenAll: true so profile key changes reload even if authorId differs
    const unsub = subscribeProfile(
      authorId,
      () => {
        setProfile(resolveProfile(authorId, repWork));
      },
      { listenAll: true }
    );

    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, authorId, repEmailKey, repWalletKey]);

  const author = useMemo(
    () => pickAuthorFromProfile(authorId, profile, repWork),
    [authorId, profile, repWork]
  );

  const avatarUrl = useMemo(() => toGateway(author.avatar), [author.avatar]);

  /* stats */
  const stats = useMemo(() => {
    const cats = new Set<string>();
    const langs = new Set<string>();
    works.forEach((w) => {
      const c = String(w.category || "").trim();
      const l = String(w.language || "").trim();
      if (c) cats.add(c);
      if (l) langs.add(l);
    });
    return { total: works.length, cats: cats.size, langs: langs.size };
  }, [works]);

  /* modal */
  const [selected, setSelected] = useState<Work | null>(null);

  // FIX hydration: always return <main> (do not switch div/main between SSR & client)
  if (!mounted) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>⏳</div>
            <div className={styles.emptyTitle}>Loading author profile...</div>
            <div className={styles.emptySub}>Please wait a moment</div>
          </div>
        </div>
      </main>
    );
  }

  if (!authorId) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>⚠️</div>
            <div className={styles.emptyTitle}>Missing authorId</div>
            <div className={styles.emptySub}>URL must be /author/[id]</div>
          </div>
        </div>
      </main>
    );
  }

  if (works.length === 0) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <Link className={styles.backLink} href="/search">
            <ArrowLeft size={16} weight="bold" /> Back to search
          </Link>

          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>👤</div>
            <div className={styles.emptyTitle}>Author not found</div>
            <div className={styles.emptySub}>
              No verified works found for authorId:{" "}
              <b className={styles.mono}>{authorId}</b>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <Link className={styles.backLink} href="/search">
            <ArrowLeft size={16} weight="bold" /> Back
          </Link>

          <div className={styles.rightHint}>
            <span className={styles.chainPill}>SUI</span>
          </div>
        </div>

        <section className={styles.headerCard}>
          <div className={styles.headerLeft}>
            <div className={styles.avatarRing}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.avatarImg} src={avatarUrl} alt={author.name || "Author"} />
              ) : (
                <div className={styles.avatarFallback}>
                  <UserCircle size={30} weight="fill" />
                </div>
              )}
            </div>

            <div className={styles.headerText}>
              <div className={styles.nameRow}>
                <h1 className={styles.name}>{author.name || "Author"}</h1>
                <span className={styles.verifiedPill}>
                  <ShieldCheck size={14} weight="fill" /> Verified
                </span>
              </div>

              <div className={styles.subRow}>
                <span className={styles.subItem}>
                  <Envelope size={14} weight="bold" />
                  {author.email || "—"}
                </span>

                <span className={styles.subDot}>•</span>

                <span className={styles.subItem} title="Author ID">
                  <Info size={14} weight="bold" />
                  <span className={styles.mono}>{author.id}</span>
                </span>
              </div>
            </div>
          </div>

          <div className={styles.headerRight}>
            <div className={styles.stat}>
              <div className={styles.statVal}>{stats.total}</div>
              <div className={styles.statLab}>Works</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statVal}>{stats.cats}</div>
              <div className={styles.statLab}>Category</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statVal}>{stats.langs}</div>
              <div className={styles.statLab}>Language</div>
            </div>
          </div>
        </section>

        <section className={styles.detailGrid}>
          <div className={styles.detailCard}>
            <div className={styles.detailHead}>
              <div className={styles.detailTitle}>Details</div>
              <div className={styles.detailHint}>
                Source: profileStore (preferred) / fallback from works
              </div>
            </div>

            <div className={styles.kvGrid}>
              <KV icon={<Wallet size={16} weight="bold" />} label="Wallet" value={author.wallet ? shortAddr(author.wallet) : "—"} mono />
              <KV icon={<Phone size={16} weight="bold" />} label="Phone" value={author.phone || "—"} />
              <KV icon={<GlobeHemisphereWest size={16} weight="bold" />} label="Country" value={author.country || "—"} />
              <KV icon={<MapPin size={16} weight="bold" />} label="Address" value={author.address || "—"} />
            </div>

            {!profile ? (
              <div className={styles.note}>
                * No profile in profileStore for this authorId -&gt; showing fallback data from works.
              </div>
            ) : (
              <div className={styles.note}>
                * Showing profileStore data (may map by email/wallet) for:{" "}
                <b className={styles.mono}>{authorId}</b>.
              </div>
            )}
          </div>

          <div className={styles.detailCardAlt}>
            <div className={styles.altHead}>
              <div className={styles.altTitle}>Recent activity</div>
              <div className={styles.altSub}>List of verified works by the author</div>
            </div>

            <div className={styles.altList}>
              {works.slice(0, 4).map((w) => (
                <button key={w.id} className={styles.altItem} onClick={() => setSelected(w)}>
                  <MusicNotes size={16} weight="fill" />
                  <div className={styles.altText}>
                    <div className={styles.altName}>{w.title}</div>
                    <div className={styles.altMeta}>
                      <span className={styles.altPill}>{w.category || "—"}</span>
                      <span className={styles.altPill2}>{w.language || "—"}</span>
                    </div>
                  </div>
                  <ArrowRight size={16} weight="bold" />
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Verified works</h2>
          <p className={styles.sectionSub}>Click a card to view details.</p>
        </section>

        <section className={styles.grid}>
          {works.map((w) => (
            <AuthorWorkCard key={w.id} work={w} onOpen={() => setSelected(w)} />
          ))}
        </section>
      </div>

      {selected ? <WorkDetailModal work={selected} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}

function KV(props: { icon: React.ReactNode; label: string; value: any; mono?: boolean }) {
  return (
    <div className={styles.kv}>
      <div className={styles.kvL}>
        <div className={styles.kvIcon}>{props.icon}</div>
        <div className={styles.kvLabel}>{props.label}</div>
      </div>
      <div className={props.mono ? styles.kvValMono : styles.kvVal}>{props.value}</div>
    </div>
  );
}

/* ===== Card + Modal keep the same design ===== */

function AuthorWorkCard(props: { work: Work; onOpen: () => void }) {
  const { work, onOpen } = props;

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
      .then((m) => alive && setMeta(m))
      .finally(() => alive && setLoadingMeta(false));

    return () => {
      alive = false;
    };
  }, [metaUrl]);

  const coverUrl = useMemo(() => {
    const cover = toGateway(meta?.properties?.cover?.url);
    const img = toGateway(meta?.image);
    return cover || img || "";
  }, [meta]);

  const mediaUrl = useMemo(() => {
    const a = toGateway(meta?.animation_url);
    const file = toGateway(meta?.properties?.file?.url);
    return a || file || "";
  }, [meta]);

  const kind = useMemo(() => guessKindFromFile(meta), [meta]);
  const createdText = useMemo(() => pickCreatedDate(work, meta), [work, meta]);

  return (
    <div
      className={styles.workCard}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
    >
      <div className={styles.workHead}>
        <div className={styles.workTitle} title={work.title}>
          {work.title}
        </div>

        <div className={styles.workBadges}>
          <span className={styles.chainPillSm}>SUI</span>
          <span className={styles.kindPill}>
            {kind === "audio" ? "Audio" : kind === "video" ? "Video" : kind === "pdf" ? "PDF" : "NFT"}
          </span>
        </div>
      </div>

      <div className={styles.preview}>
        {loadingMeta ? (
          <div className={styles.previewLoading}>Loading…</div>
        ) : coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.previewImg} src={coverUrl} alt={work.title} />
        ) : kind === "image" && mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.previewImg} src={mediaUrl} alt={work.title} />
        ) : (
          <div className={styles.previewEmpty}>No cover</div>
        )}

        <div className={styles.nftGrid} />
        <div className={styles.nftGloss} />
        <div className={styles.nftShimmer} />

        <div className={styles.dateBadge}>
          <CalendarBlank size={14} weight="bold" />
          {createdText}
        </div>

        <div className={styles.previewCta}>
          View details <ArrowRight size={16} weight="bold" />
        </div>
      </div>

      <div className={styles.workInfo}>
        <div className={styles.row}>
          <span className={styles.k}>Category</span>
          <span className={styles.v}>{work.category || "—"}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.k}>Language</span>
          <span className={styles.v}>{work.language || "—"}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.k}>NFT</span>
          <span className={styles.vMono}>{work.nftObjectId ? shortAddr(work.nftObjectId) : "—"}</span>
        </div>
      </div>
    </div>
  );
}

function WorkDetailModal(props: { work: Work; onClose: () => void }) {
  const { work, onClose } = props;

  const [meta, setMeta] = useState<any | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const metaUrl = useMemo(() => toGateway(work.hash), [work.hash]);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!metaUrl) {
        setMeta(null);
        return;
      }
      setLoadingMeta(true);
      const m = await fetchMetadata(metaUrl);
      if (alive) setMeta(m);
      if (alive) setLoadingMeta(false);
    }

    run();
    return () => {
      alive = false;
    };
  }, [metaUrl]);

  const coverUrl = useMemo(() => {
    const cover = toGateway(meta?.properties?.cover?.url);
    const img = toGateway(meta?.image);
    return cover || img || "";
  }, [meta]);

  const mediaUrl = useMemo(() => {
    const a = toGateway(meta?.animation_url);
    const file = toGateway(meta?.properties?.file?.url);
    return a || file || "";
  }, [meta]);

  const kind = useMemo(() => guessKindFromFile(meta), [meta]);
  const createdText = useMemo(() => pickCreatedDate(work, meta), [work, meta]);

  function stop(e: React.MouseEvent) {
    e.stopPropagation();
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div className={styles.modal} onClick={stop} role="dialog" aria-modal="true">
        <div className={styles.modalTop}>
          <div>
            <div className={styles.modalTitle}>{work.title}</div>
            <div className={styles.modalSub}>
              <span className={styles.chainPillSm}>SUI</span>
              <span className={styles.kindPill}>
                {kind === "audio" ? "Audio" : kind === "video" ? "Video" : kind === "pdf" ? "PDF" : "NFT"}
              </span>
              <span className={styles.modalDot}>•</span>
              <span className={styles.mono}>{createdText}</span>
            </div>
          </div>

          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className={styles.modalPreview}>
          {loadingMeta ? (
            <div className={styles.previewLoading}>Loading…</div>
          ) : coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.modalImg} src={coverUrl} alt={work.title} />
          ) : (
            <div className={styles.previewEmpty}>No cover</div>
          )}

          <div className={styles.nftGrid} />
          <div className={styles.nftGloss} />

          <div className={styles.modalBadges}>
            <span className={styles.verifiedBadge}>
              <ShieldCheck size={14} weight="fill" /> Verified
            </span>
            {work.nftObjectId ? <span className={styles.monoPill}>{shortAddr(work.nftObjectId)}</span> : null}
          </div>
        </div>

        <div className={styles.mediaBox}>
          <div className={styles.mediaHead}>
            <div className={styles.mediaTitle}>Preview file</div>
            {mediaUrl ? (
              <a className={styles.link} href={mediaUrl} target="_blank" rel="noreferrer">
                Open file
              </a>
            ) : null}
          </div>

          {!mediaUrl ? (
            <div className={styles.mediaEmpty}>No preview file.</div>
          ) : kind === "audio" ? (
            <audio className={styles.audio} controls src={mediaUrl} />
          ) : kind === "video" ? (
            <video className={styles.video} controls src={mediaUrl} />
          ) : kind === "pdf" ? (
            <iframe className={styles.pdf} src={mediaUrl} title="pdf-preview" />
          ) : kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.modalImg2} src={mediaUrl} alt="preview" />
          ) : (
            <div className={styles.mediaEmpty}>
              Unable to detect type.{" "}
              <a className={styles.link} href={mediaUrl} target="_blank" rel="noreferrer">
                Open file
              </a>
            </div>
          )}
        </div>

        <div className={styles.modalGrid}>
          <MiniKV label="Author" value={String(work.authorName || work.authorId || "—")} />
          <MiniKV label="Email" value={String(work.authorEmail || work.email || "—")} />
          <MiniKV label="Category" value={String(work.category || "—")} />
          <MiniKV label="Language" value={String(work.language || "—")} />
          <MiniKV label="NFT" value={work.nftObjectId ? String(work.nftObjectId) : "—"} mono />
          <MiniKV label="Metadata" value={metaUrl ? metaUrl : "—"} mono linkHref={metaUrl || ""} />
        </div>

        {meta?.description ? <div className={styles.metaDesc}>{meta.description}</div> : null}
      </div>
    </div>
  );
}

function MiniKV(props: { label: string; value: any; mono?: boolean; linkHref?: string }) {
  const content =
    props.linkHref && String(props.value || "").startsWith("http") ? (
      <a className={styles.link} href={props.linkHref} target="_blank" rel="noreferrer">
        {props.value}
      </a>
    ) : (
      props.value
    );

  return (
    <div className={styles.kv2}>
      <div className={styles.k2}>{props.label}</div>
      <div className={props.mono ? styles.v2Mono : styles.v2}>{content}</div>
    </div>
  );
}
