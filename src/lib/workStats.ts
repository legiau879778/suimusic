import { safeLoad, safeSave } from "./storage";
import { addReviewLog } from "./reviewLogStore";
import { getActiveAdminWallet } from "./adminWalletStore";
import { detectGenre } from "./genreDetector";
import type { UserRole } from "@/context/AuthContext";

/* ================= STORAGE ================= */

const STORAGE_KEY = "chainstorm_works";

/* ================= TYPES ================= */

export type WorkStatus = "pending" | "verified" | "rejected";

export type Work = {
  id: string;
  title: string;
  authorId: string;
  hash?: string;

  category?: string;
  language?: string;

  status: WorkStatus;

  approvalMap: Record<string, number>;
  rejectionBy: string[];

  verifiedAt?: string;
  rejectedAt?: string;

  /** soft delete */
  deletedAt?: string | null;
};

/* ================= INTERNAL ================= */

function load(): Work[] {
  return safeLoad<Work[]>(STORAGE_KEY) || [];
}

function save(data: Work[]) {
  safeSave(STORAGE_KEY, data);
  dispatch();
}

function dispatch() {
  window.dispatchEvent(new Event("works_updated"));
}

/* ================= GETTERS ================= */

export function getWorks() {
  return load();
}

export function getActiveWorks() {
  return load().filter(w => !w.deletedAt);
}

export function getTrashWorks() {
  return load().filter(w => w.deletedAt);
}

export function getPendingWorks() {
  return load().filter(
    w => w.status === "pending" && !w.deletedAt
  );
}

export function getVerifiedWorks() {
  return load().filter(
    w => w.status === "verified" && !w.deletedAt
  );
}

export function getWorkById(id: string) {
  return load().find(w => w.id === id);
}

/* ================= CREATE ================= */

export function addWork(data: {
  title: string;
  authorId: string;
  hash?: string;
  language?: string;
}) {
  const works = load();

  const autoGenre = detectGenre({
    title: data.title,
    language: data.language,
  });

  works.push({
    id: crypto.randomUUID(),
    title: data.title,
    authorId: data.authorId,
    hash: data.hash,
    category:
      autoGenre !== "Unknown"
        ? autoGenre
        : undefined,
    language: data.language,
    status: "pending",
    approvalMap: {},
    rejectionBy: [],
    deletedAt: null,
  });

  save(works);
}

/* ================= SOFT DELETE ================= */

export function softDeleteWork(params: {
  workId: string;
  actor: { id: string; role: UserRole };
}) {
  const { workId, actor } = params;
  const works = load();
  const w = works.find(x => x.id === workId);
  if (!w) return { error: "NOT_FOUND" as const };

  if (
    actor.role !== "admin" &&
    w.authorId !== actor.id
  ) {
    return { error: "FORBIDDEN" as const };
  }

  w.deletedAt = new Date().toISOString();

  addReviewLog({
    id: crypto.randomUUID(),
    workId: w.id,
    workTitle: w.title,
    action: "deleted",
    adminEmail:
      actor.role === "admin"
        ? actor.id
        : undefined,
    adminRole: actor.role,
    time: new Date().toISOString(),
  });

  save(works);
  return { ok: true };
}

/* ================= RESTORE ================= */

export function restoreWork(params: {
  workId: string;
  actor: { id: string; role: UserRole };
}) {
  const { workId, actor } = params;
  const works = load();
  const w = works.find(x => x.id === workId);
  if (!w || !w.deletedAt)
    return { error: "INVALID_WORK" as const };

  if (
    actor.role !== "admin" &&
    w.authorId !== actor.id
  ) {
    return { error: "FORBIDDEN" as const };
  }

  w.deletedAt = null;

  addReviewLog({
    id: crypto.randomUUID(),
    workId: w.id,
    workTitle: w.title,
    action: "restored",
    adminEmail:
      actor.role === "admin"
        ? actor.id
        : undefined,
    adminRole: actor.role,
    time: new Date().toISOString(),
  });

  save(works);
  return { ok: true };
}

/* ================= APPROVE ================= */

export async function approveWork(params: {
  workId: string;
  admin: { email: string; role: UserRole };
}) {
  const { workId, admin } = params;
  const works = load();
  const w = works.find(x => x.id === workId);
  if (!w || w.status !== "pending")
    return { error: "INVALID_WORK" as const };

  const wallet = getActiveAdminWallet(admin.email);
  if (!wallet)
    return { error: "WALLET_REQUIRED" as const };

  w.approvalMap[wallet.address] = 1;
  w.status = "verified";
  w.verifiedAt = new Date().toISOString();

  addReviewLog({
    id: crypto.randomUUID(),
    workId,
    workTitle: w.title,
    action: "approved",
    adminEmail: admin.email,
    adminRole: admin.role,
    time: new Date().toISOString(),
  });

  save(works);
  return { ok: true };
}

/* ================= REJECT ================= */

export async function rejectWork(params: {
  workId: string;
  admin: { email: string; role: UserRole };
  reason?: string;
}) {
  const { workId, admin, reason } = params;
  const works = load();
  const w = works.find(x => x.id === workId);
  if (!w || w.status !== "pending")
    return { error: "INVALID_WORK" as const };

  w.status = "rejected";
  w.rejectedAt = new Date().toISOString();
  w.rejectionBy.push(admin.email);

  addReviewLog({
    id: crypto.randomUUID(),
    workId,
    workTitle: w.title,
    action: "rejected",
    adminEmail: admin.email,
    adminRole: admin.role,
    time: new Date().toISOString(),
    reason,
  });

  save(works);
  return { ok: true };
}

/* ================= STATS ================= */

export function countWorksByAuthor(authorId: string) {
  return load().filter(
    w =>
      w.authorId === authorId &&
      w.status === "verified" &&
      !w.deletedAt
  ).length;
}
