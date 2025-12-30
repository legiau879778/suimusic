"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";

import {
  autoCleanTrash,
  bindLicenseToWork,
  addWork,
  getWorkByProofId,
  getActiveWorks,
  getTrashWorks,
  markWorkSold,
  patchWork,
  restoreWork,
  softDeleteWork,
  updateNFTOwner,
  bindNFTToWork,
  syncWorksFromChain,
} from "@/lib/workStore";
import type { Work } from "@/lib/workStore";
import { addTrade } from "@/lib/tradeStore";
import { AI_LYRICS_EVENT, loadAiLyrics, removeAiLyrics, type AiLyricsItem } from "@/lib/aiStore";

import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import styles from "./manage.module.css";
import {
  PROFILE_UPDATED_EVENT,
  findProfileByEmail,
  findProfileByWallet,
  loadProfile,
} from "@/lib/profileStore";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

/* ===== SUI SDK (NEW) ===== */
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientContext,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";

/* ✅ network-aware config */
import { getChainstormConfig, normalizeSuiNet } from "@/lib/chainstormConfig";

type ViewMode = "active" | "trash" | "pending" | "ai";
type MarketFilter = "all" | "sell" | "license";

const PAGE_SIZE = 12;

/* ================= Utils ================= */

function shortAddr(a?: string) {
  if (!a) return "—";
  if (a.length <= 12) return a;
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function normalizeAddress(input?: string) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  return raw.toLowerCase().startsWith("0x") ? raw : `0x${raw}`;
}

function strToBytes(s: string) {
  return new TextEncoder().encode(s);
}

function normalizeHex(input: string): string {
  const raw = String(input || "").trim().toLowerCase();
  const cleaned = raw.startsWith("0x") ? raw.slice(2) : raw;
  return cleaned.replace(/[^0-9a-f]/g, "");
}

function hexToBytes32(hex: string): Uint8Array {
  const cleaned = normalizeHex(hex);
  if (cleaned.length !== 64) {
    throw new Error("Hash must be 32 bytes (64 hex chars).");
  }
  const bytes = cleaned.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) || [];
  return new Uint8Array(bytes);
}

function extractCreatedObjectId(packageId: string, module: string, changes: any[] | undefined) {
  if (!Array.isArray(changes)) return null;
  const created = changes.find(
    (c) =>
      c?.type === "created" &&
      typeof c?.objectType === "string" &&
      c.objectType.includes(`${packageId}::${module}::WorkNFT`) &&
      c?.objectId
  );
  if (created?.objectId) return created.objectId as string;

  const anyCreated = changes.find((c) => c?.type === "created" && c?.objectId);
  return anyCreated?.objectId ?? null;
}

function isValidSuiAddress(input?: string) {
  const raw = normalizeAddress(input);
  return /^0x[0-9a-fA-F]{64}$/.test(raw);
}

function parseSuiAmount(input?: string) {
  const raw = String(input || "").trim().replace(",", ".");
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

function explorerObjUrl(net: "devnet" | "testnet" | "mainnet", objectId: string) {
  return `https://suiexplorer.com/object/${objectId}?network=${net}`;
}
function explorerTxUrl(net: "devnet" | "testnet" | "mainnet", digest: string) {
  return `https://suiexplorer.com/txblock/${digest}?network=${net}`;
}

/**
 * ✅ FIX: toGateway phải accept CIDv0 + CIDv1 phổ biến (bafy/bafk/baf...).
 * Tránh tình trạng cover/preview bị "" => No cover
 */
function toGateway(input?: string) {
  if (!input) return "";

  let v = String(input).trim();

  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.startsWith("/api/walrus/blob/")) return v;
  if (v.startsWith("walrus:")) return `/api/walrus/blob/${v.slice("walrus:".length)}`;
  if (v.startsWith("walrus://")) return `/api/walrus/blob/${v.slice("walrus://".length)}`;

  if (v.startsWith("ipfs://")) v = v.slice("ipfs://".length);

  v = v.replace(/^\/+/, "");
  if (v.startsWith("ipfs/")) v = v.slice("ipfs/".length);

  v = v.split("?")[0].split("#")[0];

  const isLikelyCid =
    v.startsWith("Qm") ||
    v.startsWith("bafy") ||
    v.startsWith("bafk") ||
    v.startsWith("baf");

  if (!isLikelyCid) return "";

  return `https://gateway.pinata.cloud/ipfs/${v}`;
}

function normalizeIpfsUrl(url?: string) {
  return toGateway(url);
}
function cidToGateway(cidOrUrl?: string) {
  return toGateway(cidOrUrl);
}

  function statusLabel(s?: string) {
    if (s === "verified") return "Approved";
    if (s === "pending") return "Pending";
    if (s === "rejected") return "Rejected";
    return "—";
  }

function PendingCard({
  proof,
  net,
  onMint,
  mintingProofId,
}: {
  proof: any;
  net: "devnet" | "testnet" | "mainnet";
  onMint: () => void;
  mintingProofId?: string | null;
}) {
  const [meta, setMeta] = useState<any>(proof?.metadata || null);

  useEffect(() => {
    let alive = true;
    async function loadMeta() {
      if (meta || !proof?.walrusMetaId) return;
      try {
        const res = await fetch(`/api/walrus/blob/${proof.walrusMetaId}`);
        if (!res.ok) return;
        const json = await res.json();
        if (alive) setMeta(json);
      } catch {
        // ignore
      }
    }
    loadMeta();
    return () => {
      alive = false;
    };
  }, [meta, proof?.walrusMetaId]);

  const cover = normalizeIpfsUrl(proof?.walrusCoverId ? `walrus:${proof.walrusCoverId}` : "");
  const metaCover =
    normalizeIpfsUrl(meta?.cover_image) ||
    normalizeIpfsUrl(meta?.properties?.cover_image) ||
    normalizeIpfsUrl(meta?.properties?.cover?.url) ||
    normalizeIpfsUrl(meta?.image);
  const preview = cover || metaCover;
  const metaLink = proof?.walrusMetaId ? `/api/walrus/blob/${proof.walrusMetaId}` : "";
  const status = statusLabel(proof?.status);
  const isApproved = proof?.status === "approved";
  const title = meta?.name || proof?.title || "Unnamed";

  const usageRights =
    meta?.properties?.usageRights ||
    meta?.properties?.usage_rights ||
    meta?.usage_rights ||
    meta?.usageRights ||
    meta?.attributes?.find?.((a: any) => a?.trait_type === "usage_rights")?.value ||
    "—";
  const category =
    meta?.properties?.category ||
    meta?.attributes?.find?.((a: any) => a?.trait_type === "category")?.value ||
    "—";
  const language =
    meta?.properties?.language ||
    meta?.attributes?.find?.((a: any) => a?.trait_type === "language")?.value ||
    "—";
  const duration =
    meta?.properties?.duration ||
    meta?.duration ||
    meta?.file?.duration ||
    meta?.properties?.file?.duration;

  return (
    <div className={styles.card}>
      <div className={styles.preview}>
        {preview ? (
          <img className={styles.previewImg} src={preview} alt={title} />
        ) : (
          <div className={styles.previewEmpty}>No cover</div>
        )}
        <div className={styles.previewOverlay}>
          <span className={styles.previewCta}>{status}</span>
        </div>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.titleRow}>
          <div className={styles.title}>{title}</div>
          <div className={styles.badge}>{status}</div>
        </div>
        <div className={styles.metaLine}>
          <span className={styles.monoSmall}>proof: {shortAddr(proof.id)}</span>
        </div>
        <div className={styles.metaLine}>
          <span className={styles.monoSmall}>net: {net}</span>
          {proof?.walrusMetaId ? (
            <a
              className={styles.link}
              href={metaLink}
              target="_blank"
              rel="noreferrer"
              style={{ marginLeft: 8 }}
            >
              metadata
            </a>
          ) : null}
        </div>
        <div className={styles.metaLine}>
          <span className={styles.mutedSmall}>
            {category} • {language} {duration ? `• ${duration}s` : ""}
          </span>
        </div>
        <div className={styles.metaLine}>
          <span className={styles.mutedSmall}>Usage: {usageRights}</span>
        </div>
        <div className={styles.cardActions}>
          <button
            className={styles.btnSecondary}
            onClick={() => onMint()}
            disabled={!isApproved || mintingProofId === proof.id}
            title={isApproved ? "Mint now" : "Chờ duyệt để mint"}
          >
            {mintingProofId === proof.id
              ? "Starting..."
              : isApproved
              ? "Mint now"
              : "Waiting approval"}
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizeWalrusId(v: string) {
  const raw = String(v || "").trim();
  if (!raw) return "";
  if (raw.startsWith("0x") && /^[0-9a-fA-F]{64}$/.test(raw.slice(2))) {
    return raw.slice(2);
  }
  return raw;
}

function normalizeHashToAddress(hex?: string) {
  const raw = String(hex || "").trim().toLowerCase();
  if (!raw) return "";
  const cleaned = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (cleaned.length !== 64) return "";
  return `0x${cleaned}`;
}

function resolveAuthorDisplayName(authorId?: string, fallback?: string) {
  const id = String(authorId || "").trim();
  if (!id) return String(fallback || "—");

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

function resolveMetaInput(work: Work) {
  const raw = String(
    work?.walrusMetaId ||
      (work as any)?.metadataCid ||
      (work as any)?.metadata ||
      work?.hash ||
      ""
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

/** createdDate display for UI (work.createdDate ưu tiên) */
function pickCreatedDate(work: Work, meta: any | null) {
  const w = String(work.createdDate || "").trim();
  if (w) return w;

  const m1 = String(meta?.properties?.createdDate || "").trim();
  if (m1) return m1;

  const mIso = String(meta?.properties?.createdAtISO || "").trim();
  if (mIso) return toDDMMYYYY(mIso);

  return "—";
}

/** SHA-256(CID) -> 0x..(32 bytes hex) */
async function cidToAddressHex(cid: string): Promise<string> {
  const enc = new TextEncoder();
  const raw = enc.encode(cid);
  const hash = await crypto.subtle.digest("SHA-256", raw);
  const bytes = new Uint8Array(hash);
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** ✅ FIX: đọc mime/name từ nhiều nơi (top-level + properties) */
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

/* ============ Metadata cache (memory) ============ */

const META_CACHE = new Map<string, any>();
const META_ERR = new Set<string>();

async function fetchMetadata(metaCidOrUrl: string) {
  const url = cidToGateway(metaCidOrUrl);
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

/* ================= Page ================= */

export default function ManagePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const suiCtx = useSuiClientContext();
  const { mutateAsync: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();

  const activeNet = normalizeSuiNet(suiCtx?.network);
  const cfg = getChainstormConfig(activeNet);

  const PACKAGE_ID = cfg?.packageId || "";
  const REGISTRY_ID = cfg?.registryId || "";
  const MODULE = cfg?.module || "chainstorm_nft";
  const MINT_FN = cfg?.mintFn || "mint";

  const [view, setView] = useState<ViewMode>("active");
  const [filter, setFilter] = useState<MarketFilter>("all");

  const [works, setWorks] = useState<Work[]>([]);
  const [pendingProofs, setPendingProofs] = useState<any[]>([]);
  const [aiList, setAiList] = useState<AiLyricsItem[]>([]);
  const pendingUnsubRef = useRef<(() => void) | undefined>(undefined);
  const [page, setPage] = useState(1);

  /** ✅ FIX TS: cho phép string luôn (fallback "") */
  const prevStatus = useRef<Record<string, string>>({});

  const [syncingOwners, setSyncingOwners] = useState<Record<string, boolean>>({});
  const [syncingAll, setSyncingAll] = useState(false);

  // ✅ per-card busy state
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [licensingId, setLicensingId] = useState<string | null>(null);
  const [burningId, setBurningId] = useState<string | null>(null);

  const [selected, setSelected] = useState<Work | null>(null);
  const [listingMap, setListingMap] = useState<Record<string, any>>({});
  const [actionModal, setActionModal] = useState<{
    type: "sell" | "license";
    work: Work;
  } | null>(null);
  const [actionBuyer, setActionBuyer] = useState("");
  const [actionPrice, setActionPrice] = useState("1");
  const [actionRoyalty, setActionRoyalty] = useState("10");
  const [actionError, setActionError] = useState("");
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);
  const [gasLoading, setGasLoading] = useState(false);
  const [gasError, setGasError] = useState("");
  const [mintingProofId, setMintingProofId] = useState<string | null>(null);

  /* ================= Load list ================= */

  const userId = user?.id || "";
  const userEmail = String(user?.email || "").trim();
  const userRole = (user as any)?.role || "";
  const userWallets = useMemo(() => {
    const list = [
      user?.internalWallet?.address,
      user?.walletAddress,
      currentAccount?.address,
    ]
      .filter(Boolean)
      .map((w) => String(w).toLowerCase());
    return Array.from(new Set(list));
  }, [currentAccount?.address, user?.internalWallet?.address, user?.walletAddress]);

  const isWorkOwner = useCallback(
    (w: Work) => {
      if (userRole === "admin") return true;
      if (!userId && !userEmail) return false;
      if (userId && w.authorId === userId) return true;
      if (userEmail && w.authorId === userEmail) return true;
      return false;
    },
    [userId, userEmail, userRole]
  );

  const load = useCallback(() => {
    if (!userId && userWallets.length === 0 && userRole !== "admin") {
      setWorks([]);
      setPendingProofs([]);
      return;
    }

    const base = view === "trash" ? getTrashWorks() : getActiveWorks();
    let list = base.filter(isWorkOwner);
    if (view === "active") {
      list = list.filter((w) => (w as any)?.status !== "pending");
    }

    if (filter !== "all") {
      list = list.filter(
        (w) =>
          (filter === "sell" && w.sellType === "exclusive") ||
          (filter === "license" && w.sellType === "license")
      );
    }

    // toast status change
    list.forEach((w) => {
      const id = String(w.id);
      const cur = (w.status ?? "") as string;

      const prev = prevStatus.current[id];
      if (prev && prev !== cur) {
        showToast(
          `Work "${w.title}" ${cur === "verified" ? "has been approved" : "has been rejected"}`,
          cur === "verified" ? "success" : "warning"
        );
      }

      // ✅ FIX TS: luôn là string
      prevStatus.current[id] = cur;
    });

    setWorks(list as Work[]);
  }, [filter, showToast, userId, userRole, userWallets.length, view, isWorkOwner]);

  const loadPending = useCallback(() => {
    if (!userId) {
      setPendingProofs([]);
      return;
    }
    if (pendingUnsubRef.current) pendingUnsubRef.current();
    const q = query(collection(db, "proofs"), where("authorId", "==", userId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setPendingProofs(rows);
      },
      () => {
        setPendingProofs([]);
      }
    );
    pendingUnsubRef.current = unsub;
  }, [userId]);

  useEffect(() => {
    autoCleanTrash();
    if (view === "pending") {
      loadPending();
    } else if (view === "ai") {
      setAiList(loadAiLyrics(userId || userEmail || "guest"));
    } else {
      syncWorksFromChain({ network: activeNet, force: true })
        .then(load)
        .catch(() => load());
    }
    window.addEventListener("works_updated", load);
    if (view === "ai") {
      const onAiUpdate = () => setAiList(loadAiLyrics(userId || userEmail || "guest"));
      window.addEventListener(AI_LYRICS_EVENT, onAiUpdate);
      return () => {
        window.removeEventListener("works_updated", load);
        window.removeEventListener(AI_LYRICS_EVENT, onAiUpdate);
        if (pendingUnsubRef.current) pendingUnsubRef.current();
      };
    }
    return () => {
      window.removeEventListener("works_updated", load);
      if (pendingUnsubRef.current) pendingUnsubRef.current();
    };
  }, [load, loadPending, view]);

  useEffect(() => {
    let alive = true;
    async function loadListings() {
      try {
        const res = await fetch(`/api/chainstorm/listings?network=${activeNet}`);
        const data = await res.json();
        if (!alive) return;
        if (!data?.ok || !Array.isArray(data?.data)) {
          setListingMap({});
          return;
        }
        const next: Record<string, any> = {};
        for (const item of data.data) {
          const workId = String(item?.workId || "").toLowerCase();
          if (!workId) continue;
          next[workId] = item;
        }
        setListingMap(next);
      } catch {
        if (alive) setListingMap({});
      }
    }
    loadListings();
    return () => {
      alive = false;
    };
  }, [activeNet]);

  const setRegisterDraft = useCallback((draft: Record<string, any>) => {
    if (typeof window === "undefined") return;
    try {
      const current = window.localStorage.getItem("chainstorm_register_draft");
      let parsed: any = {};
      if (current) {
        parsed = JSON.parse(current);
      }
      const next = {
        ...parsed,
        ...draft,
        updatedAt: Date.now(),
      };
      window.localStorage.setItem("chainstorm_register_draft", JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const handleMintProof = useCallback(
    async (proofId: string) => {
      setMintingProofId(proofId);
      try {
        if (!PACKAGE_ID || !REGISTRY_ID) throw new Error("Missing package/registry config.");
        const res = await fetch(`/api/proof/${encodeURIComponent(proofId)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok || !data?.proof) throw new Error("Could not load proof");
        const p = data.proof;
        if (String(p.status || "") !== "approved") {
          throw new Error("Proof not approved yet.");
        }

        const meta = p.metadata || {};
        const attrs = Array.isArray(meta.attributes) ? meta.attributes : [];
        const getAttr = (k: string) =>
          attrs.find((a: any) => (a?.trait_type || "").toLowerCase() === k)?.value;

        const fileHash = String(p.fileHash || "").trim();
        const metaHash = String(p.metaHash || "").trim();
        const walrusFileId = String(p.walrusFileId || "").trim();
        const walrusMetaId = String(p.walrusMetaId || "").trim();
        if (!fileHash || !metaHash || !walrusFileId || !walrusMetaId) {
          throw new Error("Proof missing Walrus/hash data.");
        }

        const fileHashBytes32 = hexToBytes32(fileHash);
        const metaHashBytes32 = hexToBytes32(metaHash);
        const walrusFileIdBytes = Array.from(strToBytes(walrusFileId));
        const walrusMetaIdBytes = Array.from(strToBytes(walrusMetaId));
        const authorSigBytes = Array.from(strToBytes(String(p.authorSignature || "")));
        const tsaIdBytes = Array.from(strToBytes(String(p.tsa?.id || "")));
        const tsaSigBytes = Array.from(strToBytes(String(p.tsa?.signature || "")));
        const approvalSigBytes = Array.from(strToBytes(String(p.approval?.signature || "")));
        const proofIdBytes = Array.from(strToBytes(String(p.id || "")));
        const tsaMillis = Date.parse(String(p.tsa?.time || ""));
        const tsaTime = Number.isFinite(tsaMillis) ? Math.floor(tsaMillis / 1000) : 0;

        const sellType =
          meta.properties?.sellType ||
          getAttr("selltype") ||
          getAttr("sell_type") ||
          getAttr("sell_type_u8") ||
          p.sellType ||
          "exclusive";
        const sellTypeU8 = sellType === "exclusive" ? 1 : sellType === "license" ? 2 : 0;
        const royaltyNum = Number(
          meta.properties?.royalty_percent ?? getAttr("royalty_percent") ?? p.royalty ?? 5
        );

        const tx = new Transaction();
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::${MINT_FN}`,
          arguments: [
            tx.object(REGISTRY_ID),
            tx.pure.vector("u8", Array.from(fileHashBytes32)),
            tx.pure.vector("u8", Array.from(metaHashBytes32)),
            tx.pure.vector("u8", walrusFileIdBytes),
            tx.pure.vector("u8", walrusMetaIdBytes),
            tx.pure.vector("u8", authorSigBytes),
            tx.pure.vector("u8", tsaIdBytes),
            tx.pure.vector("u8", tsaSigBytes),
            tx.pure.u64(tsaTime),
            tx.pure.vector("u8", approvalSigBytes),
            tx.pure.vector("u8", proofIdBytes),
            tx.pure.u8(sellTypeU8),
            tx.pure.u8(Math.max(0, Math.min(100, Math.floor(royaltyNum || 0)))),
          ],
        });

        const result = await signAndExecuteTransaction({ transaction: tx });
        const digest = (result as any)?.digest as string | undefined;
        if (!digest) throw new Error("No digest from transaction.");

        let createdObjectId: string | null = extractCreatedObjectId(
          PACKAGE_ID,
          MODULE,
          (result as any)?.objectChanges
        );
        if (!createdObjectId) {
          try {
            await suiClient.waitForTransaction({ digest });
          } catch {}
          const txb = await suiClient.getTransactionBlock({
            digest,
            options: { showObjectChanges: true, showEffects: true },
          });
          createdObjectId = extractCreatedObjectId(
            PACKAGE_ID,
            MODULE,
            (txb as any)?.objectChanges as any[]
          );
        }
        if (!createdObjectId) throw new Error("Mint succeeded but no WorkNFT id found.");

        const maybeWork = getWorkByProofId(p.id);
        const workId =
          maybeWork?.id ||
          addWork({
            title: meta.name || p.title || "",
            authorId: p.authorId || meta?.properties?.author?.userId || "",
            authorName:
              meta?.properties?.author?.name || meta?.author?.name || meta?.properties?.authorName,
            authorEmail:
              meta?.properties?.author?.email ||
              meta?.author?.email ||
              meta?.properties?.email ||
              "",
            authorWallet: p.wallet || p.authorWallet || "",
            hash: `walrus:${walrusMetaId}`,
            fileHash,
            metaHash,
            walrusFileId,
            walrusMetaId,
            walrusCoverId: p.walrusCoverId,
            durationSec:
              meta?.properties?.duration ||
              meta?.duration ||
              meta?.file?.duration ||
              meta?.properties?.file?.duration,
            proofId: p.id,
            authorSignature: p.authorSignature,
            tsaId: p.tsa?.id,
            tsaSignature: p.tsa?.signature,
            tsaTime: p.tsa?.time,
            approvalSignature: p.approval?.signature,
            approvalWallet: p.approval?.adminWallet,
            approvalTime: p.approval?.time,
            category:
              meta?.properties?.category ||
              getAttr("category") ||
              meta?.category ||
              undefined,
            language:
              meta?.properties?.language ||
              getAttr("language") ||
              meta?.language ||
              undefined,
            createdDate: meta?.properties?.createdDate || undefined,
            sellType,
            royalty: royaltyNum,
            exclusivePriceSui:
              meta?.properties?.exclusive_price_sui ?? getAttr("exclusive_price_sui") ?? 0,
            licensePriceSui:
              meta?.properties?.license_price_sui ?? getAttr("license_price_sui") ?? 0,
            quorumWeight: 1,
          });

        bindNFTToWork({
          workId,
          nftObjectId: createdObjectId,
          packageId: PACKAGE_ID,
          txDigest: digest,
          authorWallet: p.wallet || p.authorWallet || "",
        });

        setPendingProofs((prev) => prev.filter((x) => x.id !== proofId));
        showToast("Mint successful", "success");
        setView("active");
        syncWorksFromChain({ network: activeNet, force: true })
          .then(load)
          .catch(() => load());
      } catch (e: any) {
        showToast(e?.message || "Unable to mint proof", "error");
      } finally {
        setMintingProofId(null);
      }
    },
    [
      PACKAGE_ID,
      REGISTRY_ID,
      MODULE,
      MINT_FN,
      showToast,
      signAndExecuteTransaction,
      suiClient,
      load,
    ]
  );

  useEffect(() => setPage(1), [view, filter]);

  /* ================= Pagination ================= */

  const totalPages = useMemo(() => {
    const count =
      view === "pending"
        ? pendingProofs.length
        : view === "ai"
          ? aiList.length
          : works.length;
    return Math.max(1, Math.ceil(count / PAGE_SIZE));
  }, [view, pendingProofs.length, works.length, aiList.length]);

  const visible = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    if (view === "pending") return pendingProofs.slice(start, start + PAGE_SIZE);
    if (view === "ai") return aiList.slice(start, start + PAGE_SIZE);
    return works.slice(start, start + PAGE_SIZE);
  }, [works, pendingProofs, aiList, page, view]);

  /* ================= Auto-sync chain -> store ================= */

  const syncOneWorkFromChain = useCallback(
    async (w: Work) => {
      if (!PACKAGE_ID?.startsWith("0x")) return;

      // Case 1: đã có nftObjectId => sync owner
      if (w.nftObjectId) {
        const obj = await suiClient.getObject({
          id: w.nftObjectId,
          options: { showOwner: true },
        });
        const owner = (obj as any)?.data?.owner?.AddressOwner as string | undefined;
        const code = String((obj as any)?.error?.code || "");

        if (!owner) {
          if (code.toLowerCase() === "deleted" || code.toLowerCase() === "not_found") {
            patchWork(w.id, { nftObjectId: "", nftPackageId: "" });
          }
          return;
        }

        if (owner.toLowerCase() !== String(w.authorWallet || "").toLowerCase()) {
          updateNFTOwner({ workId: w.id, newOwner: owner });
        }
        return;
      }

      // Case 2: chưa có nftObjectId => scan theo file_hash / meta_hash
      const fileHashAddr = normalizeHashToAddress(w.fileHash);
      const metaHashAddr = normalizeHashToAddress(w.metaHash);
      if (!fileHashAddr && !metaHashAddr) return;

      const ownerToScan = currentAccount?.address || w.authorWallet;
      if (!ownerToScan) return;

      const type = `${PACKAGE_ID}::${MODULE}::WorkNFT`;

      let cursor: string | null | undefined = null;

      for (let i = 0; i < 6; i++) {
        const resp = await suiClient.getOwnedObjects({
          owner: ownerToScan,
          filter: { StructType: type },
          options: { showContent: true, showType: true },
          cursor: cursor ?? undefined,
          limit: 50,
        });

        for (const it of resp.data as any[]) {
          const objectId = it?.data?.objectId as string | undefined;
          const fields = it?.data?.content?.fields;
          const fh = String(fields?.file_hash || "").toLowerCase();
          const mh = String(fields?.meta_hash || "").toLowerCase();
          const match =
            (fileHashAddr && fh === fileHashAddr.toLowerCase()) ||
            (metaHashAddr && mh === metaHashAddr.toLowerCase());

          if (objectId && match) {
            bindNFTToWork({
              workId: w.id,
              nftObjectId: objectId,
              packageId: PACKAGE_ID,
              txDigest: w.txDigest || "",
              authorWallet: ownerToScan,
            });
            return;
          }
        }

        cursor = resp.nextCursor;
        if (!resp.hasNextPage) break;
      }
    },
    [MODULE, PACKAGE_ID, currentAccount?.address, suiClient]
  );

  async function handleSyncAll(reason?: string) {
    if (!currentAccount?.address) {
      showToast("Please connect your wallet to sync", "warning");
      return;
    }
    if (!PACKAGE_ID?.startsWith("0x")) {
      showToast(`Missing packageId for network ${activeNet}`, "error");
      return;
    }

    try {
      setSyncingAll(true);
      showToast(reason || "Auto-syncing NFTs from chain...", "info");

      const base = getActiveWorks();
      const list = base.filter(isWorkOwner);

      const candidates = list.filter((w) => !!w.hash || !!w.nftObjectId);

      const toProcess = candidates.slice(0, 8);
      for (const w of toProcess) {
        // eslint-disable-next-line no-await-in-loop
        await syncOneWorkFromChain(w);
      }

      showToast("✅ Sync xong (nếu có NFT sẽ tự bind / sync owner)", "success");
    } catch (e) {
      console.error(e);
      showToast("Sync thất bại", "error");
    } finally {
      setSyncingAll(false);
    }
  }

  useEffect(() => {
    if (!userId) return;
    if (!currentAccount?.address) return;
    if (!PACKAGE_ID?.startsWith("0x")) return;
    if (view !== "active") return;

    const t = setInterval(() => {
      if (syncingAll || isPending) return;

      void (async () => {
        try {
          const base = getActiveWorks();
          const list = base.filter(isWorkOwner);

          const candidates = list.filter((w) => !!w.hash || !!w.nftObjectId);
          const need = candidates.filter((w) => !w.nftObjectId || !w.authorWallet);

          for (const w of need.slice(0, 4)) {
            // eslint-disable-next-line no-await-in-loop
            await syncOneWorkFromChain(w);
          }
        } catch {
          // silent
        }
      })();
    }, 30_000);

    return () => clearInterval(t);
  }, [
    userId,
    userRole,
    currentAccount?.address,
    PACKAGE_ID,
    view,
    syncingAll,
    isPending,
    syncOneWorkFromChain,
  ]);

  /* ================= Actions ================= */

  async function handleSyncOwner(work: Work) {
    if (!work?.nftObjectId) return;
    try {
      setSyncingOwners((m) => ({ ...m, [work.id]: true }));

      const obj = await suiClient.getObject({
        id: work.nftObjectId,
        options: { showOwner: true },
      });

      const owner = (obj as any)?.data?.owner?.AddressOwner as string | undefined;
      const code = String((obj as any)?.error?.code || "");
      if (!owner) {
        if (code.toLowerCase() === "deleted" || code.toLowerCase() === "not_found") {
          patchWork(work.id, { nftObjectId: "", nftPackageId: "" });
          showToast("NFT đã bị xóa trên chain, đã gỡ liên kết", "warning");
          return;
        }
        showToast("Cannot read owner from chain", "warning");
        return;
      }

      updateNFTOwner({ workId: work.id, newOwner: owner });
      showToast(`Owner synced: ${shortAddr(owner)}`, "success");
    } catch (e) {
      console.error(e);
      showToast("Sync owner failed", "error");
    } finally {
      setSyncingOwners((m) => ({ ...m, [work.id]: false }));
    }
  }

  async function handleBurnNFT(work: Work) {
    if (!currentAccount) {
      showToast("Vui lòng kết nối ví", "warning");
      return;
    }
    if (!PACKAGE_ID?.startsWith("0x")) {
      showToast(`Missing packageId for network ${activeNet}`, "error");
      return;
    }
    if (!cfg?.registryId?.startsWith("0x")) {
      showToast(`Missing registryId for network ${activeNet}`, "error");
      return;
    }
    if (!work.nftObjectId) {
      showToast("Work chưa có NFT để burn", "warning");
      return;
    }

    const listed = listingMap[String(work.nftObjectId || "").toLowerCase()];
    if (listed) {
      showToast("NFT đang được list, vui lòng hủy list trước", "warning");
      return;
    }

    const ok = confirm(
      `Burn NFT của "${work.title}"?\nHash sẽ được reset trong registry để bạn mint lại.`
    );
    if (!ok) return;

    try {
      setBurningId(work.id);
      showToast("Đang burn NFT...", "info");

      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::burn_nft`,
        arguments: [tx.object(cfg.registryId), tx.object(work.nftObjectId)],
      });

      const result = await signAndExecuteTransaction({ transaction: tx });

      patchWork(work.id, {
        nftObjectId: "",
        nftPackageId: "",
        txDigest: (result as any).digest || "",
        mintedAt: "",
      });

      showToast("✅ Burn thành công, bạn có thể mint lại", "success");
    } catch (e) {
      console.error(e);
      showToast("Burn thất bại", "error");
    } finally {
      setBurningId(null);
    }
  }

  async function executeSellNFT(work: Work, buyer: string, priceNum: number) {
    if (!currentAccount) {
      showToast("Please connect your wallet", "warning");
      return;
    }
    if (!PACKAGE_ID?.startsWith("0x")) {
      showToast(`Missing packageId for network ${activeNet}`, "error");
      return;
    }
    if (!work.nftObjectId) {
      showToast("Work not bound to NFT (click Auto-sync NFT)", "warning");
      return;
    }

    const priceMist = BigInt(Math.floor(priceNum * 1_000_000_000));
    if (priceMist <= BigInt(0)) {
      showToast("Giá không hợp lệ", "warning");
      return;
    }

    try {
      setSellingId(work.id);
      showToast("Processing NFT sale transaction...", "info");

      const tx = new Transaction();
      const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(priceMist)]);

      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::sell_nft`,
        arguments: [
          tx.object(work.nftObjectId),
          payment,
          tx.pure.u64(priceMist),
          tx.pure.address(buyer),
        ],
      });

      const result = await signAndExecuteTransaction({ transaction: tx });

      markWorkSold({
        workId: work.id,
        buyerWallet: buyer,
        txDigest: (result as any).digest,
        priceMist: priceMist.toString(),
      });
      if (userId) {
        addTrade(userId, {
          id: crypto.randomUUID(),
          type: "sell",
          title: work.title || "Sell NFT",
          amountSui: priceNum || 0,
          txHash: (result as any).digest,
          status: "pending",
          createdAt: Date.now(),
          workId: work.id,
        });
      }

      showToast("🎉 Bán NFT thành công", "success");
    } catch (e) {
      console.error(e);
      showToast("Giao dịch thất bại", "error");
    } finally {
      setSellingId(null);
    }
  }

  async function executeIssueLicense(work: Work, licensee: string, royalty: number) {
    if (!currentAccount) {
      showToast("Vui lòng kết nối ví", "warning");
      return;
    }
    if (!PACKAGE_ID?.startsWith("0x")) {
      showToast(`Missing packageId for network ${activeNet}`, "error");
      return;
    }
    if (!work.nftObjectId) {
      showToast("Work not bound to WorkNFT (click Auto-sync NFT)", "warning");
      return;
    }

    if (Number.isNaN(royalty) || royalty < 0 || royalty > 100) {
      showToast("Royalty không hợp lệ", "warning");
      return;
    }

    try {
      setLicensingId(work.id);
      showToast("Issuing license...", "info");

      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::issue_license`,
        arguments: [
          tx.object(work.nftObjectId),
          tx.pure.address(licensee),
          tx.pure.u8(Math.floor(royalty)),
        ],
      });

      const result = await signAndExecuteTransaction({ transaction: tx });

      bindLicenseToWork({
        workId: work.id,
        licensee,
        royalty,
        txDigest: (result as any).digest,
      });
      if (userId) {
        addTrade(userId, {
          id: crypto.randomUUID(),
          type: "license",
          title: work.title || "Issue License",
          amountSui: 0,
          txHash: (result as any).digest,
          status: "pending",
          createdAt: Date.now(),
          workId: work.id,
        });
      }

      showToast("✅ Cấp license thành công", "success");
    } catch (e) {
      console.error(e);
      showToast("Cấp license thất bại", "error");
    } finally {
      setLicensingId(null);
    }
  }

  function openSellModal(work: Work) {
    const lastBuyer = String(localStorage.getItem("chainstorm_last_buyer") || "");
    setActionModal({ type: "sell", work });
    setActionBuyer(lastBuyer);
    setActionPrice("1");
    setActionRoyalty(String(work.royalty ?? 10));
    setActionError("");
    setGasEstimate(null);
    setGasError("");
  }

  function openLicenseModal(work: Work) {
    const lastBuyer = String(localStorage.getItem("chainstorm_last_buyer") || "");
    setActionModal({ type: "license", work });
    setActionBuyer(lastBuyer);
    setActionPrice("1");
    setActionRoyalty(String(work.royalty ?? 10));
    setActionError("");
    setGasEstimate(null);
    setGasError("");
  }

  async function submitActionModal() {
    if (!actionModal) return;
    const { type, work } = actionModal;

    const buyer = normalizeAddress(actionBuyer);
    if (!isValidSuiAddress(buyer)) {
      setActionError("Ví người mua không hợp lệ");
      return;
    }

    if (type === "sell") {
      const priceNum = parseSuiAmount(actionPrice);
      if (!priceNum || priceNum <= 0) {
        setActionError("Giá không hợp lệ");
        return;
      }
      setActionError("");
      localStorage.setItem("chainstorm_last_buyer", buyer);
      await executeSellNFT(work, buyer, priceNum);
      setActionModal(null);
      return;
    }

    const royaltyNum = Number(actionRoyalty);
    if (Number.isNaN(royaltyNum) || royaltyNum < 0 || royaltyNum > 100) {
      setActionError("Royalty không hợp lệ");
      return;
    }
    setActionError("");
    localStorage.setItem("chainstorm_last_buyer", buyer);
    await executeIssueLicense(work, buyer, Math.floor(royaltyNum));
    setActionModal(null);
  }

  async function pasteBuyerFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        showToast("Clipboard trống", "warning");
        return;
      }
      setActionBuyer(text.trim());
    } catch {
      showToast("Không đọc được clipboard", "warning");
    }
  }

  async function estimateGas() {
    if (!actionModal) return;
    if (!currentAccount) {
      showToast("Vui lòng kết nối ví", "warning");
      return;
    }
    if (!PACKAGE_ID?.startsWith("0x")) {
      showToast(`Missing packageId for network ${activeNet}`, "error");
      return;
    }
    const { type, work } = actionModal;
    const buyer = normalizeAddress(actionBuyer);
    if (!isValidSuiAddress(buyer)) {
      setGasError("Ví người mua không hợp lệ");
      return;
    }
    setGasError("");
    setGasEstimate(null);
    setGasLoading(true);
    try {
      const tx = new Transaction();
      if (type === "sell") {
        const priceNum = parseSuiAmount(actionPrice);
        if (!priceNum || priceNum <= 0) {
          setGasError("Giá không hợp lệ");
          return;
        }
        const priceMist = BigInt(Math.floor(priceNum * 1_000_000_000));
        const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(priceMist)]);
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::sell_nft`,
          arguments: [
            tx.object(work.nftObjectId || ""),
            payment,
            tx.pure.u64(priceMist),
            tx.pure.address(buyer),
          ],
        });
      } else {
        const royaltyNum = Number(actionRoyalty);
        if (Number.isNaN(royaltyNum) || royaltyNum < 0 || royaltyNum > 100) {
          setGasError("Royalty không hợp lệ");
          return;
        }
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::issue_license`,
          arguments: [
            tx.object(work.nftObjectId || ""),
            tx.pure.address(buyer),
            tx.pure.u8(Math.floor(royaltyNum)),
          ],
        });
      }

      const bytes = await tx.build({ client: suiClient as any });
      const dry = await (suiClient as any).dryRunTransactionBlock({
        transactionBlock: bytes,
      });
      const gasUsed = dry?.effects?.gasUsed;
      if (gasUsed) {
        const total =
          Number(gasUsed.computationCost || 0) +
          Number(gasUsed.storageCost || 0) -
          Number(gasUsed.storageRebate || 0);
        const sui = total / 1e9;
        setGasEstimate(`${sui.toFixed(6)} SUI`);
      } else {
        setGasEstimate("—");
      }
    } catch (e) {
      console.error(e);
      setGasError("Không ước lượng được gas");
    } finally {
      setGasLoading(false);
    }
  }

  async function handleSoftDelete(work: Work) {
    if (!userId) return;

    const ok = confirm(`Đưa "${work.title}" vào thùng rác?`);
    if (!ok) return;

    try {
      softDeleteWork({
        workId: work.id,
        actor: { id: userId, role: userRole as any },
        walletAddress: currentAccount?.address,
      });
      if (work.nftObjectId) {
        await setDoc(
          doc(db, "works", work.nftObjectId),
          {
            authorId: work.authorId,
            workId: work.id,
            nftObjectId: work.nftObjectId,
            deletedAt: serverTimestamp(),
            deletedBy: userId,
          },
          { merge: true }
        );
      }
      showToast("🗑️ Moved to trash", "success");
    } catch (e: any) {
      console.error(e);
      if (String(e?.message).includes("FORBIDDEN")) {
        showToast("You do not have permission to delete this work", "error");
      } else {
        showToast("Delete failed", "error");
      }
    }
  }

  async function handleRestore(work: Work) {
    if (!userId) return;

    if (userRole !== "admin" && work.authorId !== userId) {
      showToast("Bạn không có quyền khôi phục", "warning");
      return;
    }

    const ok = confirm(`Khôi phục "${work.title}"?`);
    if (!ok) return;

    try {
      if (userRole === "admin") {
        restoreWork({ workId: work.id, actor: { id: userId, role: userRole as any } });
      } else {
        patchWork(work.id, { deletedAt: null });
      }
      if (work.nftObjectId) {
        await setDoc(
          doc(db, "works", work.nftObjectId),
          {
            authorId: work.authorId,
            workId: work.id,
            nftObjectId: work.nftObjectId,
            deletedAt: null,
            restoredAt: serverTimestamp(),
            restoredBy: userId,
          },
          { merge: true }
        );
      }
      showToast("♻️ Work restored", "success");
    } catch (e: any) {
      console.error(e);
      showToast("Restore failed", "error");
    }
  }

  /* ================= Render ================= */

  if (!userId) {
    return (
      <div className={styles.page}>
        <div className={styles.locked}>
          <h2>Not logged in</h2>
          <p>Please log in to manage your works.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ===== Header ===== */}
      <div className={styles.header}>
        <div className={styles.headLeft}>
          <h1 className={styles.headTitle}>Manage Works</h1>
          <div className={styles.headSub}>
            Network: <b>{activeNet}</b> • pkg:{" "}
            <b className={styles.mono}>{PACKAGE_ID ? shortAddr(PACKAGE_ID) : "missing"}</b>
          </div>
        </div>

        <div className={styles.headRight}>
          <button className={styles.btnPrimary} onClick={() => router.push("/register-work")}>
            + Register Work
          </button>

          <button
            className={styles.btnSecondary}
            onClick={() => handleSyncAll("Auto-syncing NFTs from chain...")}
            disabled={syncingAll || isPending}
            title="Scan WorkNFT in wallet by file_hash/meta_hash"
          >
            {syncingAll ? "Syncing..." : "Auto-sync NFT"}
          </button>

          <div className={styles.selectWrap}>
            <select
              className={styles.select}
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="sell">Sell outright</option>
              <option value="license">License</option>
            </select>

            <select
              className={styles.select}
              value={view}
              onChange={(e) => setView(e.target.value as any)}
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="ai">A.I</option>
              <option value="trash">Trash</option>
            </select>
          </div>
        </div>
      </div>

      {/* ===== Empty ===== */}
      {(
        view === "pending"
          ? pendingProofs.length === 0
          : view === "ai"
            ? aiList.length === 0
            : works.length === 0
      ) ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🎵</div>
          <div className={styles.emptyTitle}>
            {view === "pending"
              ? "No submissions yet"
              : view === "ai"
                ? "No AI drafts yet"
                : "No works yet"}
          </div>
          <div className={styles.emptySub}>
            {view === "pending"
              ? "Submit a filing in Register Work to see it here."
              : view === "ai"
                ? "Generate lyrics in AI Generator to save them here."
                : "Register your first work to mint NFT."}
          </div>
        </div>
      ) : null}

      {/* ===== Grid ===== */}
      {view === "pending" ? (
        <div className={styles.grid}>
          {visible.map((p: any) => (
            <PendingCard
              key={p.id}
              proof={p}
              net={activeNet}
              onMint={() => handleMintProof(p.id)}
              mintingProofId={mintingProofId}
            />
          ))}
        </div>
      ) : view === "ai" ? (
        <div className={styles.grid}>
          {visible.map((item: AiLyricsItem) => (
            <AiCard
              key={item.id}
              item={item}
              onCopy={() => navigator.clipboard.writeText(item.lyrics)}
              onRemove={() => {
                removeAiLyrics(userId || userEmail || "guest", item.id);
                setAiList(loadAiLyrics(userId || userEmail || "guest"));
              }}
            />
          ))}
        </div>
      ) : (
        <div className={styles.grid}>
          {visible.map((w) => (
              <WorkCard
                key={w.id}
                work={w}
                net={activeNet}
                onOpen={() => setSelected(w)}
                onSell={() => openSellModal(w)}
                onIssueLicense={() => openLicenseModal(w)}
                onSyncOwner={() => handleSyncOwner(w)}
                onBurn={() => handleBurnNFT(w)}
                onDelete={() => handleSoftDelete(w)}
                onRestore={() => handleRestore(w)}
                view={view}
                disableGlobal={isPending || syncingAll}
                selling={sellingId === w.id}
                licensing={licensingId === w.id}
                burning={burningId === w.id}
                syncingOwner={!!syncingOwners[w.id]}
                listing={listingMap[String(w.nftObjectId || "").toLowerCase()]}
              />
            ))}
        </div>
      )}

      {/* ===== Pagination ===== */}
      {(
        view === "pending"
          ? pendingProofs.length > 0
          : view === "ai"
            ? aiList.length > 0
            : works.length > 0
      ) ? (
        <div className={styles.pager}>
          <button
            className={styles.pagerBtn}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Trước
          </button>

          <div className={styles.pagerInfo}>
            Trang <b>{page}</b>/<b>{totalPages}</b> •{" "}
            <span className={styles.muted}>
              {(view === "pending"
                ? pendingProofs.length
                : view === "ai"
                  ? aiList.length
                  : works.length)}{" "}
              items
            </span>
          </div>

          <button
            className={styles.pagerBtn}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Sau →
          </button>
        </div>
      ) : null}

      {/* ===== Modal detail ===== */}
      {selected ? (
        <WorkDetailModal
          work={selected}
          net={activeNet}
          onClose={() => setSelected(null)}
          onSell={() => openSellModal(selected)}
          onIssueLicense={() => openLicenseModal(selected)}
          onSyncOwner={() => handleSyncOwner(selected)}
          onBurn={() => handleBurnNFT(selected)}
          onDelete={() => handleSoftDelete(selected)}
          onRestore={() => handleRestore(selected)}
          view={view}
          disableGlobal={isPending || syncingAll}
          selling={sellingId === selected.id}
          licensing={licensingId === selected.id}
          burning={burningId === selected.id}
          syncingOwner={!!syncingOwners[selected.id]}
        />
      ) : null}

      {actionModal ? (
        <div className={styles.modalOverlay} role="presentation">
          <div className={`${styles.modalPro} ${styles.modalCompact}`} role="dialog" aria-modal="true">
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitle}>
                  {actionModal.type === "sell" ? "Sell NFT" : "Issue License"}
                </div>
                <div className={styles.modalSub}>
                  <span className={styles.badge2}>{actionModal.work.title}</span>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setActionModal(null)}>
                ✕
              </button>
            </div>

            <div className={styles.editBox}>
              <div className={styles.editRow}>
                <div className={styles.editLabel}>Buyer wallet (0x...)</div>
                <div className={styles.editInline}>
                  <input
                    className={styles.editInput}
                    value={actionBuyer}
                    onChange={(e) => setActionBuyer(e.target.value)}
                    placeholder="0x..."
                  />
                  <button
                    type="button"
                    className={styles.miniBtn}
                    onClick={pasteBuyerFromClipboard}
                  >
                    Paste
                  </button>
                </div>
              </div>

              {actionModal.type === "sell" ? (
                <div className={styles.editRow}>
                  <div className={styles.editLabel}>Price (SUI)</div>
                  <input
                    className={styles.editInput}
                    value={actionPrice}
                    onChange={(e) => setActionPrice(e.target.value)}
                    placeholder="1"
                  />
                </div>
              ) : null}

              {actionModal.type === "license" ? (
                <div className={styles.editRow}>
                  <div className={styles.editLabel}>Royalty % (0-100)</div>
                  <input
                    className={styles.editInput}
                    value={actionRoyalty}
                    onChange={(e) => setActionRoyalty(e.target.value)}
                    placeholder="10"
                  />
                </div>
              ) : null}

              {actionError ? <div className={styles.warnText}>{actionError}</div> : null}
              {gasError ? <div className={styles.warnText}>{gasError}</div> : null}
              {gasEstimate ? (
                <div className={styles.mutedSmall}>Estimated gas: {gasEstimate}</div>
              ) : null}

              <div className={styles.editActions}>
                <button
                  className={styles.actionGhost}
                  onClick={estimateGas}
                  disabled={gasLoading || isPending || sellingId != null || licensingId != null}
                >
                  {gasLoading ? "Estimating..." : "Estimate gas"}
                </button>
                <button
                  className={styles.actionGhost}
                  onClick={() => setActionModal(null)}
                  disabled={isPending || sellingId != null || licensingId != null}
                >
                  Cancel
                </button>
                <button
                  className={styles.actionPrimary}
                  onClick={submitActionModal}
                  disabled={isPending || sellingId != null || licensingId != null}
                >
                  {actionModal.type === "sell" ? "Confirm Sell" : "Confirm License"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ================= Components ================= */

function AiCard({
  item,
  onCopy,
  onRemove,
}: {
  item: AiLyricsItem;
  onCopy: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>AI Lyrics Draft</div>
        <div className={styles.badges}>
          <span className={styles.badge} data-status="pending">
            AI
          </span>
        </div>
      </div>

      <div className={styles.aiMeta}>
        <div>
          <b>Genre:</b> {item.genre || "—"}
        </div>
        <div>
          <b>Language:</b> {item.language || "—"}
        </div>
      </div>

      <div className={styles.aiPrompt}>
        <b>Prompt:</b> {item.prompt || "—"}
      </div>

      <div className={styles.aiLyrics}>{item.lyrics || "—"}</div>

      <div className={styles.aiActions}>
        <button className={styles.btnSecondary} onClick={onCopy} type="button">
          Copy
        </button>
        <button className={styles.btnDanger} onClick={onRemove} type="button">
          Remove
        </button>
      </div>
    </div>
  );
}

function WorkCard(props: {
  work: Work;
  net: "devnet" | "testnet" | "mainnet";
  onOpen: () => void;
  onSell: () => void;
  onIssueLicense: () => void;
  onSyncOwner: () => void;
  onBurn: () => void;
  onDelete: () => void;
  onRestore: () => void;
  view: ViewMode;
  disableGlobal: boolean;
  selling: boolean;
  licensing: boolean;
  burning: boolean;
  syncingOwner: boolean;
  listing?: any;
}) {
  const {
    work,
    net,
    onOpen,
    onSell,
    onIssueLicense,
    onSyncOwner,
    onBurn,
    onDelete,
    onRestore,
    view,
    disableGlobal,
    selling,
    licensing,
    burning,
    syncingOwner,
    listing,
  } = props;

  const [meta, setMeta] = useState<any | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const metaInput = useMemo(() => resolveMetaInput(work), [work]);
  const metaUrl = useMemo(() => cidToGateway(metaInput), [metaInput]);

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

  // ✅ cover fallback: properties.cover.url -> cover_image -> cover.url -> image
  const coverUrl = useMemo(() => {
    const cover =
      normalizeIpfsUrl(meta?.properties?.cover?.url) ||
      normalizeIpfsUrl(meta?.cover_image) ||
      normalizeIpfsUrl(meta?.cover?.url) ||
      normalizeIpfsUrl(meta?.properties?.cover_image) ||
      normalizeIpfsUrl(meta?.properties?.image);

    const img = normalizeIpfsUrl(meta?.image);
    const fromWork =
      normalizeIpfsUrl(work?.metaImage) ||
      normalizeIpfsUrl((work as any)?.image) ||
      normalizeIpfsUrl((work as any)?.cover) ||
      "";
    const coverId = String(work?.walrusCoverId || "").trim();
    const fromCoverId = coverId ? normalizeIpfsUrl(`walrus:${coverId}`) : "";
    return cover || img || fromWork || fromCoverId || "";
  }, [meta, work]);

  const kind = useMemo(() => guessKindFromFile(meta), [meta]);
  const createdText = useMemo(() => pickCreatedDate(work, meta), [work, meta]);

  function sellTypeLabel(t?: string) {
    if (t === "exclusive") return "Bán đứt";
    if (t === "license") return "License";
    return t || "—";
  }

  return (
    <div
      className={styles.card}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
    >
      <div className={styles.cardHead}>
        <div className={styles.cardTitle} title={work.title}>
          {work.title}
        </div>

      <div className={styles.badges}>
        <span className={styles.badge} data-status={work.status ?? "unknown"}>
          {statusLabel(work.status)}
        </span>
        <span className={styles.badge2}>{sellTypeLabel(work.sellType)}</span>
        {listing ? <span className={styles.badge2}>Listed</span> : null}
      </div>
      </div>

      <div className={styles.preview}>
        {loadingMeta ? (
          <div className={styles.previewLoading}>Loading…</div>
        ) : coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.previewImg} src={coverUrl} alt={work.title} />
        ) : (
          <div className={styles.previewEmpty}>No cover</div>
        )}

        <div className={styles.previewHint}>
          {kind === "audio"
            ? "🎵 Audio"
            : kind === "video"
            ? "🎬 Video"
            : kind === "pdf"
            ? "📄 PDF"
            : "🧾"}
        </div>

        <div
          className={`${styles.dateBadge} ${createdText === "—" ? styles.dateBadgeMuted : ""}`}
          title="Ngày sáng tác"
        >
          {createdText}
        </div>

        <div className={styles.previewOverlay}>
          <span className={styles.previewCta}>Xem chi tiết →</span>
        </div>
      </div>

      <div className={styles.info}>
        <div className={styles.kv}>
          <span className={styles.k}>NFT</span>
          <span className={styles.v}>
            {work.nftObjectId ? (
              <a
                className={styles.link}
                href={explorerObjUrl(net, work.nftObjectId)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {shortAddr(work.nftObjectId)}
              </a>
            ) : (
              <span className={styles.warnText}>— chưa bind</span>
            )}
          </span>
        </div>

      <div className={styles.kv}>
        <span className={styles.k}>Owner</span>
        <span className={styles.v}>
          {work.authorWallet ? shortAddr(work.authorWallet) : "—"}
        </span>
      </div>

      {listing ? (
        <div className={styles.kv}>
          <span className={styles.k}>Listing</span>
          <span className={styles.v}>{Number(listing.price || 0) / 1e9} SUI</span>
        </div>
      ) : null}

      <div className={styles.kv}>
        <span className={styles.k}>Royalty</span>
        <span className={styles.v}>
          <b>{work.royalty ?? 0}%</b>
        </span>
        </div>
      </div>

      <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
        <button
          className={styles.actionPrimary}
          onClick={onSell}
          disabled={view === "trash" || selling || disableGlobal || burning}
          title={view === "trash" ? "Restore before operation" : "Sell NFT"}
        >
          {selling ? "Selling…" : "Sell"}
        </button>

        <button
          className={styles.actionPrimary}
          onClick={onIssueLicense}
          disabled={view === "trash" || licensing || disableGlobal || burning}
          title={view === "trash" ? "Restore before operation" : "Issue license"}
        >
          {licensing ? "Issuing…" : "License"}
        </button>

        <button
          className={styles.actionGhost}
          onClick={onSyncOwner}
          disabled={!work.nftObjectId || syncingOwner || disableGlobal || burning}
          title={!work.nftObjectId ? "Chưa có NFT" : "Đọc owner từ chain"}
        >
          {syncingOwner ? "Sync…" : "Sync"}
        </button>

        <button
          className={styles.actionDanger}
          onClick={onBurn}
          disabled={
            !work.nftObjectId || view === "trash" || burning || disableGlobal || !!listing
          }
          title={
            !work.nftObjectId
              ? "Chưa có NFT"
              : listing
              ? "NFT đang được list"
              : "Burn NFT để reset hash"
          }
        >
          {burning ? "Burning…" : "Burn"}
        </button>

        {view === "active" ? (
          <button className={styles.actionDanger} onClick={onDelete} disabled={disableGlobal}>
            Xoá
          </button>
        ) : (
          <button className={styles.actionGhost} onClick={onRestore} disabled={disableGlobal}>
            Khôi phục
          </button>
        )}
      </div>
    </div>
  );
}

function WorkDetailModal(props: {
  work: Work;
  net: "devnet" | "testnet" | "mainnet";
  onClose: () => void;
  onSell: () => void;
  onIssueLicense: () => void;
  onSyncOwner: () => void;
  onBurn: () => void;
  onDelete: () => void;
  onRestore: () => void;
  view: ViewMode;
  disableGlobal: boolean;
  selling: boolean;
  licensing: boolean;
  burning: boolean;
  syncingOwner: boolean;
}) {
  const {
    work,
    net,
    onClose,
    onSell,
    onIssueLicense,
    onSyncOwner,
    onBurn,
    onDelete,
    onRestore,
    view,
    disableGlobal,
    selling,
    licensing,
    burning,
    syncingOwner,
  } = props;

  const [meta, setMeta] = useState<any | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [profileTick, setProfileTick] = useState(0);

  const metaInput = useMemo(() => resolveMetaInput(work), [work]);
  const metaUrl = useMemo(() => cidToGateway(metaInput), [metaInput]);

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

  useEffect(() => {
    const onProfile = () => setProfileTick((x) => x + 1);
    window.addEventListener(PROFILE_UPDATED_EVENT, onProfile as EventListener);
    return () =>
      window.removeEventListener(PROFILE_UPDATED_EVENT, onProfile as EventListener);
  }, []);

  const authorDisplayName = useMemo(
    () => resolveAuthorDisplayName(work.authorId, work.authorName),
    [work.authorId, work.authorName, profileTick]
  );

  const coverUrl = useMemo(() => {
    const cover =
      normalizeIpfsUrl(meta?.properties?.cover?.url) ||
      normalizeIpfsUrl(meta?.cover_image) ||
      normalizeIpfsUrl(meta?.cover?.url) ||
      normalizeIpfsUrl(meta?.properties?.cover_image) ||
      normalizeIpfsUrl(meta?.properties?.image);

    const img = normalizeIpfsUrl(meta?.image);
    const fromWork =
      normalizeIpfsUrl(work?.metaImage) ||
      normalizeIpfsUrl((work as any)?.image) ||
      normalizeIpfsUrl((work as any)?.cover) ||
      "";
    const coverId = String(work?.walrusCoverId || "").trim();
    const fromCoverId = coverId ? normalizeIpfsUrl(`walrus:${coverId}`) : "";
    return cover || img || fromWork || fromCoverId || "";
  }, [meta, work]);

  const mediaUrl = useMemo(() => {
    const a = normalizeIpfsUrl(meta?.animation_url);
    const f =
      normalizeIpfsUrl(meta?.file?.url) ||
      normalizeIpfsUrl(meta?.properties?.file?.url);
    const fileId = String(work?.walrusFileId || "").trim();
    const fromFileId = fileId ? normalizeIpfsUrl(`walrus:${fileId}`) : "";
    return a || f || fromFileId || "";
  }, [meta, work]);

  const kind = useMemo(() => guessKindFromFile(meta), [meta]);
  const createdText = useMemo(() => pickCreatedDate(work, meta), [work, meta]);

  function stop(e: MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
  }

  function statusLabel(s?: string) {
    if (s === "verified") return "Approved";
    if (s === "pending") return "Pending";
    if (s === "rejected") return "Rejected";
    return "—";
  }
  function sellTypeLabel(t?: string) {
    if (t === "exclusive") return "Bán đứt";
    if (t === "license") return "License";
    return t || "—";
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div className={styles.modalPro} onClick={stop} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>{work.title}</div>
            <div className={styles.modalSub}>
              <span className={styles.badge} data-status={work.status ?? "unknown"}>
                {statusLabel(work.status)}
              </span>
              <span className={styles.badge2}>{sellTypeLabel(work.sellType)}</span>
              <span className={styles.modalDot}>•</span>
              <span className={styles.mono}>{net}</span>
            </div>
          </div>

          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.modalPreviewPro}>
          {loadingMeta ? (
            <div className={styles.previewLoading}>Loading…</div>
          ) : coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.modalImgPro} src={coverUrl} alt={work.title} />
          ) : (
            <div className={styles.previewEmpty}>No cover</div>
          )}

          <div className={styles.previewGrid} />
          <div className={styles.previewGloss} />

          <div className={`${styles.dateBadge} ${createdText === "—" ? styles.dateBadgeMuted : ""}`}>
            {createdText}
          </div>
        </div>

        <div className={styles.mediaBoxPro}>
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
              Không có file preview (metadata thiếu animation_url / file.url).
            </div>
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
              Không nhận diện được type.{" "}
              <a className={styles.link} href={mediaUrl} target="_blank" rel="noreferrer">
                Mở file
              </a>
            </div>
          )}
        </div>

        <div className={styles.modalGridPro}>
          <KV label="Ngày sáng tác" value={createdText} />
          <KV label="Owner" value={work.authorWallet ? shortAddr(work.authorWallet) : "—"} mono />
          <KV label="Royalty" value={`${work.royalty ?? 0}%`} />

          <KV
            label="NFT"
            value={
              work.nftObjectId ? (
                <a
                  className={styles.link}
                  href={explorerObjUrl(net, work.nftObjectId)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {work.nftObjectId}
                </a>
              ) : (
                "—"
              )
            }
            mono
          />

          <KV
            label="Tx"
            value={
              work.txDigest ? (
                <a
                  className={styles.link}
                  href={explorerTxUrl(net, work.txDigest)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {work.txDigest}
                </a>
              ) : (
                "—"
              )
            }
            mono
          />

          <KV
            label="Metadata"
            value={
              metaUrl ? (
                <a className={styles.link} href={metaUrl} target="_blank" rel="noreferrer">
                  {metaUrl}
                </a>
              ) : (
                "—"
              )
            }
            mono
          />

          <KV
            label="Tác giả"
            value={`${authorDisplayName}${
              work.authorPhone ? ` • ${work.authorPhone}` : ""
            }`}
          />
        </div>

        {meta?.description ? <div className={styles.metaDesc}>{meta.description}</div> : null}

        <div className={styles.licenseBox}>
          <div className={styles.licenseHead}>
            <div className={styles.licenseTitle}>License history</div>
            <div className={styles.licenseHint}>
              {work.sellType === "license" ? "Bán theo license" : "Không phải license mode"}
            </div>
          </div>

          {work.licenses && work.licenses.length > 0 ? (
            <div className={styles.licenseList}>
              {work.licenses
                .slice()
                .reverse()
                .map((l: any, idx: number) => (
                  <div key={idx} className={styles.licenseItem}>
                    <div className={styles.licenseRow}>
                      <span className={styles.mono}>{shortAddr(l.licensee)}</span>
                      <span className={styles.royaltyPill}>{l.royalty}%</span>
                    </div>
                    <div className={styles.licenseRow2}>
                      <span className={styles.mutedSmall}>
                        {new Date(l.issuedAt).toLocaleString()}
                      </span>
                      <a
                        className={styles.linkSmall}
                        href={explorerTxUrl(net, l.txDigest)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        tx
                      </a>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className={styles.licenseEmpty}>Chưa có license nào.</div>
          )}
        </div>

        <div className={styles.modalActions}>
          <button
            className={styles.actionPrimary}
            onClick={onSell}
            disabled={view === "trash" || selling || disableGlobal || burning}
          >
            {selling ? "Selling…" : "Sell NFT"}
          </button>

          <button
            className={styles.actionPrimary}
            onClick={onIssueLicense}
            disabled={view === "trash" || licensing || disableGlobal || burning}
          >
            {licensing ? "Issuing…" : "Issue License"}
          </button>

          <button
            className={styles.actionGhost}
            onClick={onSyncOwner}
            disabled={!work.nftObjectId || syncingOwner || disableGlobal || burning}
          >
            {syncingOwner ? "Sync…" : "Sync Owner"}
          </button>

          <button
            className={styles.actionDanger}
            onClick={onBurn}
            disabled={!work.nftObjectId || view === "trash" || burning || disableGlobal}
            title={!work.nftObjectId ? "Chưa có NFT" : "Burn NFT để reset hash"}
          >
            {burning ? "Burning…" : "Burn NFT"}
          </button>

          {view === "active" ? (
            <button className={styles.actionDanger} onClick={onDelete} disabled={disableGlobal}>
              Xoá
            </button>
          ) : (
            <button className={styles.actionGhost} onClick={onRestore} disabled={disableGlobal}>
              Khôi phục
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function KV(props: { label: string; value: any; mono?: boolean }) {
  return (
    <div className={styles.kv2}>
      <div className={styles.k2}>{props.label}</div>
      <div className={props.mono ? styles.v2Mono : styles.v2}>{props.value}</div>
    </div>
  );
}
