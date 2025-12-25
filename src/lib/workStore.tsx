// src/lib/workStore.tsx
import { safeLoad, safeSave } from "./storage";
import { addReviewLog } from "./reviewLogStore";
import type { UserRole } from "@/context/AuthContext";

/* ✅ profile sync (read-only) */
import { loadProfile } from "@/lib/profileStore";

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

  authorName?: string;
  authorEmail?: string;
  authorAvatar?: string;
  authorPhone?: string;
  authorWallet?: string;

  category?: string;
  language?: string;
  createdDate?: string;

  // ✅ sellType is REQUIRED here -> must never be undefined
  sellType: "exclusive" | "license" | string;
  royalty?: number;
  quorumWeight: number;

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

function load(): Work[] {
  const works = safeLoad<Work[]>(STORAGE_KEY);
  return Array.isArray(works) ? works : [];
}

function save(data: Work[]) {
  safeSave(STORAGE_KEY, data);

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

/**
 * ✅ SSR-safe wrapper for loadProfile
 * - build/SSR: không đọc localStorage
 * - client: đọc profileStore bình thường
 */
function resolveAuthorSnapshot(authorId: string) {
  if (typeof window === "undefined") {
    return { authorName: authorId, authorPhone: "" };
  }

  const p = loadProfile(authorId);
  const authorName = p?.name && p.name.trim() ? p.name.trim() : authorId;
  const authorPhone = p?.phone ?? "";
  return { authorName, authorPhone };
}

/** ✅ normalize sellType to avoid undefined */
function normalizeSellType(v?: string): "exclusive" | "license" | string {
  const s = String(v || "").trim();
  if (!s) return "exclusive";
  if (s === "exclusive" || s === "license") return s;
  return s; // allow custom string if you ever used it
}

/* ================= GETTERS ================= */

export const getWorks = () => load();

export const getActiveWorks = () => load().filter((w) => !w.deletedAt);

export const getTrashWorks = () => load().filter((w) => Boolean(w.deletedAt));

export const getWorkById = (id: string) => load().find((w) => w.id === id);

export const getVerifiedWorks = () =>
  load().filter((w) => w.status === "verified" && !w.deletedAt);

export const getPendingWorks = () =>
  load().filter((w) => w.status === "pending" && !w.deletedAt);

export const countWorksByAuthor = (authorId: string) =>
  load().filter((w) => w.authorId === authorId && !w.deletedAt).length;

/* ================= CREATE ================= */

export function addWork(data: {
  title: string;
  authorId: string;
  hash: string;

  authorName?: string;
  authorEmail?: string;
  authorAvatar?: string;
  authorPhone?: string;
  authorWallet?: string;

  category?: string;
  language?: string;
  createdDate?: string;

  sellType?: "exclusive" | "license" | string;
  royalty?: number;
  quorumWeight?: number;
}) {
  const works = load();

  const { authorName, authorPhone } = resolveAuthorSnapshot(data.authorId);

  const work: Work = {
    id: uid(),

    // ✅ keep safe (avoid empty title)
    title: String(data.title || "").trim() || "Untitled",

    authorId: data.authorId,

    authorName,
    authorPhone,

    // ✅ keep safe (avoid empty hash)
    hash: String(data.hash || "").trim(),

    language: data.language,
    category: data.category,
    createdDate: data.createdDate,

    // ✅ FIX STRICT TS: never allow undefined here
    sellType: normalizeSellType(data.sellType),

    royalty: data.royalty ?? 0,

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
 * ✅ Update authorName/authorPhone for ALL works of a user.
 */
export function updateAuthorProfileForUser(authorId: string) {
  if (typeof window === "undefined") return;
  if (!authorId) return;

  const works = load();
  const { authorName, authorPhone } = resolveAuthorSnapshot(authorId);

  let changed = false;

  for (const w of works) {
    if (w.authorId !== authorId) continue;

    if ((w.authorName ?? "") !== (authorName ?? "")) {
      w.authorName = authorName;
      changed = true;
    }
    if ((w.authorPhone ?? "") !== (authorPhone ?? "")) {
      w.authorPhone = authorPhone ?? "";
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

  window.addEventListener(WORKSTORE_PROFILE_UPDATED_EVENT, onProfileUpdated as any);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(WORKSTORE_PROFILE_UPDATED_EVENT, onProfileUpdated as any);
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

  return !!walletAddress && walletAddress.toLowerCase() === work.authorWallet.toLowerCase();
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

  if (!canEditWork({ work: w, walletAddress: params.walletAddress, actor: params.actor })) {
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
          (((w.licenses || []).reduce((s, x) => s + (x?.royalty || 0), 0) / totalLicenses) * 100) /
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

export function setWorkQuorumWeight(params: { workId: string; quorumWeight: number }) {
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

export function rejectWork(params: { workId: string; reviewerId: string; reason?: string }) {
  const works = load();
  const w = works.find((x) => x.id === params.workId);
  if (!w) return;

  w.status = "rejected";
  w.reviewedAt = Date.now();

  if (!w.rejectionBy) w.rejectionBy = [];
  if (!w.rejectionBy.includes(params.reviewerId)) w.rejectionBy.push(params.reviewerId);

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
