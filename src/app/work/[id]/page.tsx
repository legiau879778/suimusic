"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getWorkById, getVerifiedWorks, syncWorksFromChain, Work } from "@/lib/workStore";
import styles from "@/styles/work.module.css";
import Link from "next/link";
import { fetchWalrusMetadata } from "@/lib/walrusMetaCache";
import { toGateway } from "@/lib/profileStore";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getActiveMembership } from "@/lib/membershipStore";
import { canUseMusicFeature } from "@/lib/featerGuard";
import { getUsageStatus, incUsage } from "@/lib/featureUsageStore";

function resolveMetaInput(w: any) {
  const raw = String(w?.walrusMetaId || w?.metadataCid || w?.metadata || w?.hash || "").trim();
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

function resolveCover(meta: any, w: any) {
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

function resolveMedia(meta: any, w: any) {
  const raw =
    meta?.animation_url ||
    meta?.properties?.animation_url ||
    meta?.properties?.file?.url ||
    meta?.file?.url ||
    "";
  const byMeta = toGateway(raw);
  if (byMeta) return byMeta;
  const fileId = String(w?.walrusFileId || "").trim();
  if (fileId) return toGateway(`walrus:${fileId}`);
  return "";
}

function resolveThumb(w: any) {
  const raw = String(w?.metaImage || "").trim();
  const byMeta = toGateway(raw);
  if (byMeta) return byMeta;
  const coverId = String(w?.walrusCoverId || "").trim();
  if (coverId) return toGateway(`walrus:${coverId}`);
  return "";
}

function guessMediaKind(meta: any, url: string): "audio" | "video" | "image" | "pdf" | "other" {
  const mime =
    String(meta?.file?.mime || meta?.file?.type || meta?.properties?.file?.type || "")
      .toLowerCase()
      .trim();
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";
  if (mime.includes("pdf")) return "pdf";

  const u = url.toLowerCase();
  if (/\.(mp3|wav|ogg|m4a|flac)$/.test(u)) return "audio";
  if (/\.(mp4|webm|mov|mkv)$/.test(u)) return "video";
  if (/\.(png|jpg|jpeg|webp|gif|bmp|svg)$/.test(u)) return "image";
  if (/\.(pdf)$/.test(u)) return "pdf";
  return "other";
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

export default function WorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [work, setWork] = useState<Work | undefined>(undefined);
  const [meta, setMeta] = useState<any | null>(null);
  const [usageTick, setUsageTick] = useState(0);
  const [relatedPage, setRelatedPage] = useState(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!id) return;
      await syncWorksFromChain();
      if (!alive) return;
      setWork(getWorkById(id));
    }
    load();
    const onUpdate = () => {
      setWork(getWorkById(id));
    };
    window.addEventListener("works_updated", onUpdate);
    return () => {
      alive = false;
      window.removeEventListener("works_updated", onUpdate);
    };
  }, [id]);

  useEffect(() => {
    let alive = true;
    async function loadMeta() {
      if (!work) return;
      const metaInput = resolveMetaInput(work);
      if (!metaInput) {
        setMeta(null);
        return;
      }
      try {
        const json = await fetchWalrusMetadata(metaInput);
        if (alive) setMeta(json);
      } catch {
        if (alive) setMeta(null);
      } finally {
      }
    }
    loadMeta();
    return () => {
      alive = false;
    };
  }, [work]);

  useEffect(() => {
    const onUsage = () => setUsageTick((x) => x + 1);
    window.addEventListener("usage_updated", onUsage);
    return () => window.removeEventListener("usage_updated", onUsage);
  }, []);

  const membership = getActiveMembership((user?.membership as any) || null);
  const userId = user?.id || "";
  const listenLimit = 3;
  const usageStatus = useMemo(() => {
    if (membership || !userId) return null;
    return getUsageStatus(userId, "music_use", listenLimit);
  }, [membership, userId, usageTick]);

  const relatedByAuthor = useMemo(() => {
    if (!work) return [];
    return getVerifiedWorks()
      .filter((w) => w.id !== work.id && w.authorId === work.authorId)
      .slice(0, 6);
  }, [work]);

  const relatedTotalPages = Math.max(1, Math.ceil(relatedByAuthor.length / 4));
  const relatedSlice = useMemo(() => {
    const start = relatedPage * 4;
    return relatedByAuthor.slice(start, start + 4);
  }, [relatedByAuthor, relatedPage]);

  useEffect(() => {
    setRelatedPage(0);
  }, [work?.id]);

  const suggestedAuthors = useMemo(() => {
    if (!work) return [];
    const map = new Map<string, Work>();
    for (const w of getVerifiedWorks()) {
      if (w.authorId === work.authorId) continue;
      if (!map.has(w.authorId)) map.set(w.authorId, w);
      if (map.size >= 6) break;
    }
    return Array.from(map.values());
  }, [work]);

  if (!work) {
    return (
      <p style={{ padding: 40 }}>
        Work not found
      </p>
    );
  }

  const cover = resolveCover(meta, work);
  const mediaUrl = resolveMedia(meta, work);
  const mediaKind = mediaUrl ? guessMediaKind(meta, mediaUrl) : "other";

  async function handleListen() {
    if (!mediaUrl) return;
    if (!userId) {
      showToast("Please login to listen.", "warning");
      return;
    }
    const check = canUseMusicFeature({ userId, membership });
    if (!check.ok) {
      showToast(check.reason || "Listen quota reached.", "warning");
      return;
    }
    if (!membership) {
      incUsage(userId, "music_use", 1);
      setUsageTick((x) => x + 1);
    }
    audioRef.current?.play();
  }

  return (
    <main className={styles.page}>
      <div className={styles.backRow}>
        <a href="/search" className={styles.backBtn}>
          ← Back to Search
        </a>
      </div>
      <div className={styles.layout}>
        <section className={styles.main}>
          <div className={styles.card}>
        <h1 className={styles.title}>{meta?.name || meta?.title || work.title}</h1>

        {cover ? (
          <img
            className={styles.cover}
            src={cover}
            alt="Cover"
            loading="lazy"
            decoding="async"
          />
        ) : null}

        <div className={styles.metaGrid}>
          <p className={styles.meta}>
            <strong>Author:</strong>{" "}
            {work.authorName || work.authorId || "—"}
          </p>

          <p className={styles.meta}>
            <strong>Category:</strong>{" "}
            {meta?.category || meta?.properties?.category || work.metaCategory || work.category || "—"}
          </p>

          <p className={styles.meta}>
            <strong>Language:</strong>{" "}
            {meta?.language || meta?.properties?.language || work.metaLanguage || work.language || "—"}
          </p>

          <p className={styles.meta}>
            <strong>Duration:</strong>{" "}
            {formatDuration(Number(work.durationSec || meta?.duration || meta?.properties?.duration || 0))}
          </p>

          <p className={styles.meta}>
            <strong>Status:</strong>{" "}
            {work.status}
          </p>

          <p className={styles.meta}>
            <strong>Licenses:</strong>{" "}
            {Array.isArray(work.licenses) ? work.licenses.length : 0}
          </p>
        </div>

            {mediaKind === "audio" && mediaUrl ? (
              <div className={styles.audioBlock}>
            <div className={styles.audioRow}>
              <button
                type="button"
                onClick={handleListen}
                className={styles.listenBtn}
              >
                Listen
              </button>
              {!membership ? (
                <span className={styles.audioHint}>
                  Remaining: {usageStatus ? `${usageStatus.remaining}/${usageStatus.limit}` : "0/3"}
                </span>
              ) : (
                <span className={styles.audioHint}>Unlimited (membership)</span>
              )}
            </div>
            <audio
              ref={audioRef}
              controls
              preload="metadata"
              src={mediaUrl}
              className={`${styles.audio} ${
                membership || (usageStatus && usageStatus.remaining > 0) ? "" : styles.audioLocked
              }`}
            />
          </div>
            ) : null}
          </div>

          {relatedByAuthor.length > 0 ? (
            <div className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>More from this author</h2>
                <div className={styles.sectionNav}>
                  <button
                    type="button"
                    className={styles.navBtn}
                    onClick={() => setRelatedPage((p) => Math.max(0, p - 1))}
                    disabled={relatedPage === 0}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className={styles.navBtn}
                    onClick={() =>
                      setRelatedPage((p) => Math.min(relatedTotalPages - 1, p + 1))
                    }
                    disabled={relatedPage >= relatedTotalPages - 1}
                  >
                    →
                  </button>
                </div>
              </div>
              <div className={styles.relatedRow}>
                {relatedSlice.map((w) => {
                  const thumb = resolveThumb(w);
                  return (
                    <Link key={w.id} href={`/work/${w.id}`} className={styles.relatedCard}>
                      <div className={styles.relatedThumb}>
                        {thumb ? (
                          <img src={thumb} alt={w.title} loading="lazy" decoding="async" />
                        ) : (
                          <div className={styles.relatedFallback}>No cover</div>
                        )}
                      </div>
                      <div className={styles.relatedBody}>
                        <div className={styles.relatedTitle}>{w.title || "Untitled"}</div>
                        <div className={styles.relatedMeta}>
                          {w.category || "Uncategorized"}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>

        <aside className={styles.side}>
          <div className={styles.sideCard}>
            <h3 className={styles.sideTitle}>Suggested authors</h3>
            {suggestedAuthors.length === 0 ? (
              <div className={styles.sideEmpty}>No suggestions yet.</div>
            ) : (
              <div className={styles.authorList}>
                {suggestedAuthors.map((w) => (
                  <Link key={w.authorId} href={`/author/${w.authorId}`} className={styles.authorItem}>
                    <div className={styles.authorAvatar}>
                      {(w.authorName || w.authorId || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className={styles.authorInfo}>
                      <div className={styles.authorName}>
                        {w.authorName || w.authorId || "Unknown"}
                      </div>
                      <div className={styles.authorSub}>
                        {w.category || "Artist"}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
