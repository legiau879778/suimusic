// src/lib/workStore.tsx
import { safeLoad, safeSave } from "./storage";
import { addReviewLog } from "./reviewLogStore";
import type { UserRole } from "@/context/AuthContext";

/* ✅ profile sync (read-only) */
import {
  loadProfile,
  findProfileByWallet,
  findProfileByEmail,
} from "@/lib/profileStore";

/* ================= STORAGE ================= */

const STORAGE_KEY = "chainstorm_works";

/**
 * ✅ Profile update event name (fallback)
 * - Nếu profileStore bạn dispatch event khác, đổi string này cho khớp.
 * - Hiện profileStore của bạn: PROFILE_UPDATED_EVENT = "chainstorm_profile_updated"
 */
export const WORKSTORE_PROFILE_UPDATED_EVENT = "chainstorm_profile_updated";

/* ================= TYPES ================= */

/** 📜 License record (off-chain mirror) */
export type WorkLicense = {
  licensee: string;
  royalty: number; // %
  txDigest: string;
  issuedAt: string;
};

/** 💰 Sale record (exclusive) */
export type WorkSale = {
  buyer: string;
  priceMist?: string;
  txDigest: string;
  soldAt: string;
};

export type Work = {
  id: string;
  title: string;
  authorId: string;
  hash?: string;
  durationSec?: number;
  fileHash?: string;
  metaHash?: string;
  walrusFileId?: string;
  walrusMetaId?: string;
  walrusCoverId?: string;
  proofId?: string;
  authorSignature?: string;
  tsaId?: string;
  tsaSignature?: string;
  tsaTime?: string;
  approvalSignature?: string;
  approvalWallet?: string;
  approvalTime?: string;

  authorName?: string;
  authorEmail?: string;
  authorAvatar?: string;
  authorPhone?: string;
  authorWallet?: string;

  category?: string;
  language?: string;
  createdDate?: string;

  // ✅ sellType is REQUIRED here -> must never be undefined
  sellType: "exclusive" | "license" | "none" | string;
  royalty?: number;
  quorumWeight: number;
  exclusivePriceSui?: number;
  licensePriceSui?: number;

  nftObjectId?: string;
  nftPackageId?: string;
  txDigest?: string;
  mintedAt?: string;

  /** business */
  status?: "pending" | "verified" | "rejected" | string;

  licenses: WorkLicense[];

  /** exclusive sale history */
  sales?: WorkSale[];

  /** reviewerId -> weight */
  approvalMap: Record<string, number>;

  /** reviewer đã reject */
  rejectionBy: string[];

  deletedAt?: string | null;

  verifiedAt?: number | string;
  reviewedAt?: number | string;

  /** optional derived fields (UI/cache) */
  votes?: number;
  featured?: boolean;
  metaTitle?: string;
  metaImage?: string;
  metaCategory?: string;
  metaLanguage?: string;
};

/* ================= INTERNAL ================= */

function uid() {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      // @ts-ignore
      return crypto.randomUUID();
    }
  } catch {}
  return `w_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getDefaultNetwork() {
  return process.env.NEXT_PUBLIC_SUI_NETWORK || "devnet";
}

function storageKey(net?: string) {
  const n = String(net || getDefaultNetwork() || "devnet").toLowerCase();
  return `${STORAGE_KEY}_${n}`;
}

function load(net?: string): Work[] {
  const works = safeLoad<Work[]>(storageKey(net));
  return Array.isArray(works) ? works : [];
}

function save(data: Work[], net?: string) {
  safeSave(storageKey(net), data);

  // ✅ realtime notify (ManagePage / Admin Dashboard / etc.)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("works_updated"));
  }
}

function sumApprovalWeight(w: Work) {
  return Object.values(w.approvalMap || {}).reduce(
    (s, v) => s + (Number(v) || 0),
    0
  );
}

function isEmptyObj(v: any) {
  return !v || typeof v !== "object" || Object.keys(v).length === 0;
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

/**
 * ✅ resolveAuthorSnapshot(authorId)
 * - SSR: trả placeholder
 * - Client:
 *   1) loadProfile(authorId)
 *   2) nếu rỗng -> findProfileByWallet(authorId)
 *   3) nếu vẫn rỗng -> findProfileByEmail(authorId) (phòng case authorId đang là email)
 */
function resolveAuthorSnapshot(authorId: string) {
  if (typeof window === "undefined") {
    return {
      authorName: authorId,
      authorPhone: "",
      authorEmail: "",
      authorAvatar: "",
      authorWallet: "",
    };
  }

  let p = loadProfile(authorId);

  // 1️⃣ authorId là wallet
  if (isEmptyObj(p)) {
    const found = findProfileByWallet(authorId);
    if (found?.profile) p = found.profile;
  }

  // 2️⃣ authorId là email
  if (isEmptyObj(p)) {
    const found = findProfileByEmail(authorId);
    if (found?.profile) p = found.profile;
  }

  const authorName = safeStr((p as any)?.name) || authorId;
  const authorPhone = safeStr((p as any)?.phone);
  const authorEmail = safeStr((p as any)?.email);
  const authorAvatar = safeStr((p as any)?.avatar); // raw: walrus:ID or http(s)
  const authorWallet = safeStr((p as any)?.walletAddress);

  return { authorName, authorPhone, authorEmail, authorAvatar, authorWallet };
}

/** ✅ normalize sellType to avoid undefined */
function normalizeSellType(v?: string): "exclusive" | "license" | string {
  const s = String(v || "").trim();
  if (!s) return "exclusive";
  if (s === "exclusive" || s === "license" || s === "none") return s;
  return s; // allow custom string if you ever used it
}

/* ================= GETTERS ================= */

export const getWorks = () => load();

export const getActiveWorks = () => load().filter((w) => !w.deletedAt);

export const getTrashWorks = () => load().filter((w) => Boolean(w.deletedAt));

export const getWorkById = (id: string) => load().find((w) => w.id === id);

export const getWorkByProofId = (proofId?: string) => {
  const pid = String(proofId || "").trim();
  if (!pid) return undefined;
  return load().find((w) => String(w.proofId || "").trim() === pid);
};

export const getVerifiedWorks = () =>
  load().filter((w) => w.status === "verified" && !w.deletedAt);

export const getPendingWorks = () =>
  load().filter((w) => w.status === "pending" && !w.deletedAt);

export const countWorksByAuthor = (authorId: string) =>
  load().filter((w) => w.authorId === authorId && !w.deletedAt).length;

const ONCHAIN_SYNC_KEY = "chainstorm_onchain_sync";
const ONCHAIN_SYNC_TTL_MS = 20_000;

function syncKey(net?: string) {
  return `${ONCHAIN_SYNC_KEY}_${String(net || getDefaultNetwork() || "devnet").toLowerCase()}`;
}

function buildDefaults(input: Partial<Work>): Work {
  return {
    id: String(input.id || uid()),
    title: input.title || "",
    authorId: String(input.authorId || ""),
    sellType: normalizeSellType(input.sellType as string),
    quorumWeight: Number(input.quorumWeight ?? 1),
    status: (input.status as any) || "verified",
    licenses: input.licenses || [],
    approvalMap: input.approvalMap || {},
    rejectionBy: input.rejectionBy || [],
    ...input,
  } as Work;
}

function mergeOnchainWorks(list: Partial<Work>[], net?: string) {
  const current = load(net);
  const map = new Map(current.map((w) => [w.id, w]));
  const byNft = new Map<string, Work>();
  const byProof = new Map<string, Work>();
  const byMetaHash = new Map<string, Work>();
  const byWalrusMeta = new Map<string, Work>();

  for (const w of current) {
    const nft = safeStr(w.nftObjectId).toLowerCase();
    if (nft) byNft.set(nft, w);
    const proof = safeStr(w.proofId);
    if (proof) byProof.set(proof, w);
    const mh = safeStr(w.metaHash).toLowerCase();
    if (mh) byMetaHash.set(mh, w);
    const wm = safeStr(w.walrusMetaId).toLowerCase();
    if (wm) byWalrusMeta.set(wm, w);
  }

  for (const raw of list) {
    const on = buildDefaults(raw);
    const onId = safeStr(on.id).toLowerCase();
    const onProof = safeStr(on.proofId);
    const onMetaHash = safeStr(on.metaHash).toLowerCase();
    const onWalrusMeta = safeStr(on.walrusMetaId).toLowerCase();

    const existing =
      map.get(on.id) ||
      (onId ? byNft.get(onId) : undefined) ||
      (onProof ? byProof.get(onProof) : undefined) ||
      (onMetaHash ? byMetaHash.get(onMetaHash) : undefined) ||
      (onWalrusMeta ? byWalrusMeta.get(onWalrusMeta) : undefined);
    if (!existing) {
      map.set(on.id, on);
      continue;
    }

    const merged: Work = {
      ...existing,
      ...on,
      id: existing.id,
      title: existing.title || on.title,
      authorName: existing.authorName || on.authorName,
      authorEmail: existing.authorEmail || on.authorEmail,
      authorAvatar: existing.authorAvatar || on.authorAvatar,
      authorPhone: existing.authorPhone || on.authorPhone,
      category: existing.category || on.category,
      language: existing.language || on.language,
      createdDate: existing.createdDate || on.createdDate,
      metaTitle: existing.metaTitle || on.metaTitle,
      metaImage: existing.metaImage || on.metaImage,
      metaCategory: existing.metaCategory || on.metaCategory,
      metaLanguage: existing.metaLanguage || on.metaLanguage,
      votes: existing.votes ?? on.votes,
      featured: existing.featured ?? on.featured,
      approvalMap: existing.approvalMap || on.approvalMap || {},
      rejectionBy: existing.rejectionBy || on.rejectionBy || [],
      licenses: existing.licenses || on.licenses || [],
      status:
        existing.status === "pending"
          ? on.status || existing.status
          : existing.status || on.status,
    };
    map.set(existing.id, merged);
  }

  const mergedList = Array.from(map.values());
  save(mergedList, net);
  return mergedList.length;
}

export async function syncWorksFromChain(options?: {
  network?: string;
  force?: boolean;
}) {
  if (typeof window === "undefined") return 0;

  const now = Date.now();
  const lastRaw = safeLoad<number>(syncKey(options?.network));
  const last = Number(lastRaw || 0);
  if (!options?.force && now - last < ONCHAIN_SYNC_TTL_MS) return 0;

  const net = options?.network || getDefaultNetwork();
  try {
    const params = new URLSearchParams({ network: net });
    if (options?.force) params.set("force", "1");
    const res = await fetch(`/api/chainstorm/works?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const data = await res.json();
    if (!data?.ok || !Array.isArray(data?.works)) return 0;
    const count = mergeOnchainWorks(data.works as Partial<Work>[], net);
    safeSave(syncKey(net), now);
    return count;
  } catch {
    return 0;
  }
}

/* ================= CREATE ================= */

export function addWork(data: {
  title: string;
  authorId: string;
  hash: string;
  durationSec?: number;
  fileHash?: string;
  metaHash?: string;
  walrusFileId?: string;
  walrusMetaId?: string;
  walrusCoverId?: string;
  proofId?: string;
  authorSignature?: string;
  tsaId?: string;
  tsaSignature?: string;
  tsaTime?: string;
  approvalSignature?: string;
  approvalWallet?: string;
  approvalTime?: string;

  authorName?: string;
  authorEmail?: string;
  authorAvatar?: string;
  authorPhone?: string;
  authorWallet?: string;

  category?: string;
  language?: string;
  createdDate?: string;

  sellType?: "exclusive" | "license" | "none" | string;
  royalty?: number;
  quorumWeight?: number;
  exclusivePriceSui?: number;
  licensePriceSui?: number;
}) {
  const works = load();

  const snap = resolveAuthorSnapshot(data.authorId);

  const work: Work = {
    id: uid(),

    // ✅ keep safe (avoid empty title)
    title: String(data.title || "").trim() || "Untitled",

    authorId: data.authorId,

    authorName: safeStr(data.authorName) || snap.authorName,
    authorPhone: safeStr(data.authorPhone) || snap.authorPhone,

    authorEmail: safeStr(data.authorEmail) || snap.authorEmail,
    authorAvatar: safeStr(data.authorAvatar) || snap.authorAvatar,
    authorWallet: safeStr(data.authorWallet) || snap.authorWallet,

    // ✅ keep safe (avoid empty hash)
    hash: String(data.hash || "").trim(),
    durationSec: typeof data.durationSec === "number" ? data.durationSec : undefined,
    fileHash: safeStr(data.fileHash),
    metaHash: safeStr(data.metaHash),
    walrusFileId: safeStr(data.walrusFileId),
    walrusMetaId: safeStr(data.walrusMetaId),
    walrusCoverId: safeStr(data.walrusCoverId),
    proofId: safeStr(data.proofId),
    authorSignature: safeStr(data.authorSignature),
    tsaId: safeStr(data.tsaId),
    tsaSignature: safeStr(data.tsaSignature),
    tsaTime: safeStr(data.tsaTime),
    approvalSignature: safeStr(data.approvalSignature),
    approvalWallet: safeStr(data.approvalWallet),
    approvalTime: safeStr(data.approvalTime),

    language: data.language,
    category: data.category,
    createdDate: data.createdDate,

    // ✅ FIX STRICT TS: never allow undefined here
    sellType: normalizeSellType(data.sellType),

    royalty: data.royalty ?? 0,
    exclusivePriceSui: typeof data.exclusivePriceSui === "number" ? data.exclusivePriceSui : undefined,
    licensePriceSui: typeof data.licensePriceSui === "number" ? data.licensePriceSui : undefined,

    status: "pending",
    approvalMap: {},
    quorumWeight: data.quorumWeight ?? 1,
    rejectionBy: [],

    deletedAt: null,
    licenses: [],
    sales: [],
  };

  works.push(work);
  save(works);
  return work.id;
}

/* ================= AUTHOR SYNC ================= */

/**
 * ✅ Update author snapshot for ALL works of a user.
 */
export function updateAuthorProfileForUser(authorId: string) {
  if (typeof window === "undefined") return;
  if (!authorId) return;

  const works = load();
  const snap = resolveAuthorSnapshot(authorId);

  let changed = false;

  for (const w of works) {
    if (w.authorId !== authorId) continue;

    if ((w.authorName ?? "") !== (snap.authorName ?? "")) {
      w.authorName = snap.authorName;
      changed = true;
    }
    if ((w.authorPhone ?? "") !== (snap.authorPhone ?? "")) {
      w.authorPhone = snap.authorPhone ?? "";
      changed = true;
    }
    if ((w.authorEmail ?? "") !== (snap.authorEmail ?? "")) {
      w.authorEmail = snap.authorEmail ?? "";
      changed = true;
    }
    if ((w.authorAvatar ?? "") !== (snap.authorAvatar ?? "")) {
      w.authorAvatar = snap.authorAvatar ?? "";
      changed = true;
    }
    if ((w.authorWallet ?? "") !== (snap.authorWallet ?? "")) {
      w.authorWallet = snap.authorWallet ?? "";
      changed = true;
    }
  }

  if (changed) save(works);
}

/**
 * ✅ Backward compatible: only update name
 */
export function updateAuthorNameForUser(authorId: string, newName: string) {
  if (typeof window === "undefined") return;
  if (!authorId) return;

  const name = (newName || "").trim();
  if (!name) return;

  const works = load();
  let changed = false;

  for (const w of works) {
    if (w.authorId !== authorId) continue;
    if ((w.authorName ?? "") !== name) {
      w.authorName = name;
      changed = true;
    }
  }

  if (changed) save(works);
}

/**
 * ✅ Backfill/Migrate snapshots for existing works.
 * - update theo snapshot (không chỉ khi trống) để profile đổi là works đổi theo
 */
export function backfillAuthorSnapshots() {
  if (typeof window === "undefined") return;

  const works = load();
  let changed = false;

  for (const w of works) {
    const snap = resolveAuthorSnapshot(w.authorId);

    if ((w.authorName ?? "") !== (snap.authorName ?? "")) {
      w.authorName = snap.authorName;
      changed = true;
    }
    if ((w.authorPhone ?? "") !== (snap.authorPhone ?? "")) {
      w.authorPhone = snap.authorPhone ?? "";
      changed = true;
    }
    if ((w.authorEmail ?? "") !== (snap.authorEmail ?? "")) {
      w.authorEmail = snap.authorEmail ?? "";
      changed = true;
    }
    if ((w.authorAvatar ?? "") !== (snap.authorAvatar ?? "")) {
      w.authorAvatar = snap.authorAvatar ?? "";
      changed = true;
    }
    if ((w.authorWallet ?? "") !== (snap.authorWallet ?? "")) {
      w.authorWallet = snap.authorWallet ?? "";
      changed = true;
    }
  }

  if (changed) save(works);
}

/**
 * ✅ Listen profile changes and auto-sync works.
 * - same-tab: custom event (profileStore dispatch)
 * - cross-tab: storage event
 */
export function startWorkAuthorAutoSync() {
  if (typeof window === "undefined") return () => {};

  const onProfileUpdated = (ev: Event) => {
    const anyEv = ev as any;
    const userId = anyEv?.detail?.userId as string | undefined;
    if (!userId || userId === "*") return;
    updateAuthorProfileForUser(userId);
  };

  const onStorage = (e: StorageEvent) => {
    if (!e.key) return;
    if (!e.key.startsWith("chainstorm_profile:")) return;
    const userId = e.key.split("chainstorm_profile:")[1] || "";
    if (!userId) return;
    updateAuthorProfileForUser(userId);
  };

  window.addEventListener(
    WORKSTORE_PROFILE_UPDATED_EVENT,
    onProfileUpdated as any
  );
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(
      WORKSTORE_PROFILE_UPDATED_EVENT,
      onProfileUpdated as any
    );
    window.removeEventListener("storage", onStorage);
  };
}

/* ================= NFT BIND ================= */

export function bindNFTToWork(params: {
  workId: string;
  nftObjectId: string;
  packageId: string;
  txDigest: string;
  authorWallet: string;
}) {
  const works = load();
  const w = works.find((x) => x.id === params.workId);
  if (!w) return;

  w.nftObjectId = params.nftObjectId;
  w.nftPackageId = params.packageId;
  w.txDigest = params.txDigest;
  w.authorWallet = params.authorWallet;
  w.mintedAt = new Date().toISOString();
  w.status = "verified";

  save(works);
}

/* ===== ADD: helpers for chain sync ===== */

export function patchWork(workId: string, patch: Partial<Work>) {
  const works = load();
  const w = works.find((x) => x.id === workId);
  if (!w) return;
  Object.assign(w, patch);
  save(works);
}

export function setWorkVotes(workId: string, votes: number) {
  const works = load();
  const w = works.find((x) => x.id === workId);
  if (!w) return;
  w.votes = Math.max(0, Math.floor(Number(votes) || 0));
  save(works);
}

export function setWorkFeatured(workId: string, featured: boolean) {
  const works = load();
  const w = works.find((x) => x.id === workId);
  if (!w) return;
  w.featured = Boolean(featured);
  save(works);
}

export function setWorkMetadata(params: {
  workId: string;
  title?: string;
  image?: string;
  category?: string;
  language?: string;
}) {
  const works = load();
  const w = works.find((x) => x.id === params.workId);
  if (!w) return;
  if (params.title) w.metaTitle = params.title;
  if (params.image) w.metaImage = params.image;
  if (params.category) w.metaCategory = params.category;
  if (params.language) w.metaLanguage = params.language;
  save(works);
}

export const getFeaturedWorks = () =>
  load().filter((w) => w.featured && !w.deletedAt);

export function patchWorkByProofId(proofId: string, patch: Partial<Work>) {
  const works = load();
  const pid = String(proofId || "").trim();
  if (!pid) return;
  const w = works.find((x) => String(x.proofId || "").trim() === pid);
  if (!w) return;
  Object.assign(w, patch);
  save(works);
}

export function bindNFTToWorkSafe(params: {
  workId: string;
  nftObjectId: string;
  packageId: string;
  txDigest: string;
  authorWallet: string;
}) {
  patchWork(params.workId, {
    nftObjectId: params.nftObjectId,
    nftPackageId: params.packageId,
    txDigest: params.txDigest,
    authorWallet: params.authorWallet,
    mintedAt: new Date().toISOString(),
    status: "verified",
  });
}

/* ================= PERMISSION ================= */

export function canEditWork(params: {
  work: Work;
  walletAddress?: string;
  actor: { id: string; role: UserRole };
}) {
  const { work, walletAddress, actor } = params;

  if (actor.role === "admin") return true;

  if (!work.nftObjectId) {
    return actor.id === work.authorId;
  }

  if (!work.authorWallet) return false;

  return (
    !!walletAddress &&
    walletAddress.toLowerCase() === work.authorWallet.toLowerCase()
  );
}

/* ================= DELETE / RESTORE ================= */

export function softDeleteWork(params: {
  workId: string;
  actor: { id: string; role: UserRole };
  walletAddress?: string;
}) {
  const works = load();
  const w = works.find((x) => x.id === params.workId);
  if (!w) return;

  if (
    !canEditWork({
      work: w,
      walletAddress: params.walletAddress,
      actor: params.actor,
    })
  ) {
    throw new Error("FORBIDDEN");
  }

  w.deletedAt = new Date().toISOString();

  addReviewLog({
    id: uid(),
    workId: w.id,
    workTitle: w.title,
    action: "deleted",
    adminRole: params.actor.role,
    adminEmail: params.actor.role === "admin" ? params.actor.id : undefined,
    time: new Date().toISOString(),
  });

  save(works);
}

export function restoreWork(params: {
  workId: string;
  actor: { id: string; role: UserRole };
}) {
  const works = load();
  const w = works.find((x) => x.id === params.workId);
  if (!w) return;

  if (params.actor.role !== "admin") throw new Error("FORBIDDEN");

  w.deletedAt = null;

  addReviewLog({
    id: uid(),
    workId: w.id,
    workTitle: w.title,
    action: "restored",
    adminRole: params.actor.role,
    adminEmail: params.actor.id,
    time: new Date().toISOString(),
  });

  save(works);
}

/* ================= ON-CHAIN SYNC ================= */

export function updateNFTOwner(params: { workId: string; newOwner: string }) {
  const works = load();
  const w = works.find((x) => x.id === params.workId);
  if (!w) return;

  w.authorWallet = params.newOwner;
  save(works);
}

export function updateWorkConfig(params: {
  workId: string;
  sellType?: "exclusive" | "license" | "none" | string;
  royalty?: number;
}) {
  const works = load();
  const w = works.find((x) => x.id === params.workId);
  if (!w) return;

  if (params.sellType) w.sellType = normalizeSellType(params.sellType);
  if (typeof params.royalty === "number") {
    w.royalty = Math.max(0, Math.min(100, Math.floor(params.royalty)));
  }

  save(works);
}

export function markWorkSold(params: {
  workId: string;
  buyerWallet: string;
  txDigest: string;
  priceMist?: string;
}) {
  const works = load();
  const w = works.find((x) => x.id === params.workId);
  if (!w) return;

  w.authorWallet = params.buyerWallet;
  w.txDigest = params.txDigest;

  if (!Array.isArray(w.sales)) w.sales = [];
  w.sales.push({
    buyer: params.buyerWallet,
    txDigest: params.txDigest,
    priceMist: params.priceMist,
    soldAt: new Date().toISOString(),
  });

  save(works);
}

export function bindLicenseToWork(params: {
  workId: string;
  licensee: string;
  royalty: number;
  txDigest: string;
}) {
  const works = load();
  const w = works.find((x) => x.id === params.workId);
  if (!w) return;

  if (w.sellType !== "license") throw new Error("WORK_NOT_LICENSE_MODE");

  if (!Array.isArray(w.licenses)) w.licenses = [];

  w.licenses.push({
    licensee: params.licensee,
    royalty: params.royalty,
    txDigest: params.txDigest,
    issuedAt: new Date().toISOString(),
  });

  save(works);
}

/* ================= ROYALTY STATS (UI) ================= */

export function getRoyaltyStats(workId: string) {
  const w = getWorkById(workId);
  if (!w) return null;

  const totalLicenses = Array.isArray(w.licenses) ? w.licenses.length : 0;
  const avgRoyalty =
    totalLicenses === 0
      ? 0
      : Math.round(
          (((w.licenses || []).reduce((s, x) => s + (x?.royalty || 0), 0) /
            totalLicenses) *
            100) /
            100
        );

  return { totalLicenses, avgRoyalty };
}

/* ================= AUTO CLEAN TRASH ================= */

const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function autoCleanTrash() {
  const works = load();
  const now = Date.now();

  const cleaned = works.filter((w) => {
    if (!w.deletedAt) return true;
    return now - new Date(w.deletedAt).getTime() < TRASH_TTL_MS;
  });

  if (cleaned.length !== works.length) save(cleaned);
}

function getReviewerWeightByRole(role: UserRole) {
  return role === "admin" ? 2 : 1;
}

/* ================= ADMIN REVIEW ================= */

export function setWorkQuorumWeight(params: {
  workId: string;
  quorumWeight: number;
}) {
  const works = load();
  const w = works.find((x) => x.id === params.workId);
  if (!w) return;

  w.quorumWeight = Math.max(1, Math.floor(params.quorumWeight || 1));

  if (w.status !== "rejected") {
    const total = sumApprovalWeight(w);
    w.status = total >= w.quorumWeight ? "verified" : "pending";
  }

  save(works);
}

export function approveWork(params: {
  workId: string;
  reviewerId: string;
  reviewerRole?: UserRole;
  weight?: number;
}) {
  const works = load();
  const w = works.find((x) => x.id === params.workId);
  if (!w) return;

  const inferred = getReviewerWeightByRole(params.reviewerRole ?? "user");
  const weight = Math.max(1, Math.floor(params.weight ?? inferred));

  w.approvalMap[params.reviewerId] = weight;
  w.rejectionBy = (w.rejectionBy || []).filter((x) => x !== params.reviewerId);

  const total = sumApprovalWeight(w);
  w.status = total >= (w.quorumWeight || 1) ? "verified" : "pending";

  addReviewLog({
    id: uid(),
    workId: w.id,
    workTitle: w.title,
    action: w.status === "verified" ? "approved" : "approval_added",
    adminRole: params.reviewerRole ?? "admin",
    adminEmail: params.reviewerId,
    time: new Date().toISOString(),
    meta: {
      reviewerId: params.reviewerId,
      weight,
      totalWeight: total,
      quorumWeight: w.quorumWeight,
    },
  });

  // ✅ optional timestamps (useful for sorting/analytics)
  w.reviewedAt = Date.now();
  if (w.status === "verified") w.verifiedAt = Date.now();

  save(works);
}

export function rejectWork(params: {
  workId: string;
  reviewerId: string;
  reason?: string;
}) {
  const works = load();
  const w = works.find((x) => x.id === params.workId);
  if (!w) return;

  w.status = "rejected";
  w.reviewedAt = Date.now();

  if (!w.rejectionBy) w.rejectionBy = [];
  if (!w.rejectionBy.includes(params.reviewerId))
    w.rejectionBy.push(params.reviewerId);

  addReviewLog({
    id: uid(),
    workId: w.id,
    workTitle: w.title,
    action: "rejected",
    adminRole: "admin",
    adminEmail: params.reviewerId,
    time: new Date().toISOString(),
    reason: params.reason || "",
    meta: {
      reviewerId: params.reviewerId,
      reason: params.reason || "",
    },
  });

  save(works);
}
