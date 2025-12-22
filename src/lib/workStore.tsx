import { safeLoad, safeSave } from "./storage";
import { getCurrentUser } from "./authStore";
import { getActiveAdminWallet } from "./adminWalletStore";
import { signApproveMessage } from "./signMessage";
import { addReviewLog } from "./reviewLogStore";

const STORAGE_KEY = "chainstorm_works";

/* ================= TYPES ================= */

export type ReviewItem = {
  admin: string;
  action: "approved" | "rejected";
  time: string;
  weight?: number;
  reason?: string;
  proof?: string;
  signature?: string;
  txHash?: string;
};

export type Work = {
  id: string;
  title: string;
  authorId: string;

  status: "pending" | "verified" | "rejected";
  marketStatus?: "private" | "public" | "tradeable";

  quorumWeight: number;
  quorumLocked: boolean;

  approvalMap: Record<string, number>;
  rejectionBy: string[];

  reviews: ReviewItem[];

  overriddenBy?: string;
  overriddenAt?: string;
};

/* ================= INTERNAL ================= */

function load(): Work[] {
  return safeLoad<Work[]>(STORAGE_KEY);
}

function save(data: Work[]) {
  safeSave(STORAGE_KEY, data);
}

/* ================= GETTERS ================= */

export function getWorks(): Work[] {
  return load();
}

export function getPendingWorks(): Work[] {
  return load().filter((w) => w.status === "pending");
}

export function getPublicWorks(): Work[] {
  return load().filter(
    (w) =>
      w.status === "verified" &&
      (w.marketStatus === "public" ||
        w.marketStatus === "tradeable")
  );
}

/* ================= AUTHOR ================= */

export function addWork(data: {
  title: string;
  authorId: string;
  marketStatus?: "private" | "public" | "tradeable";
}) {
  const works = load();

  works.push({
    id: crypto.randomUUID(),
    title: data.title,
    authorId: data.authorId,

    status: "pending",
    marketStatus: data.marketStatus || "private",

    quorumWeight: 1,
    quorumLocked: false,

    approvalMap: {},
    rejectionBy: [],
    reviews: [],
  });

  save(works);
}

/* ================= QUORUM ================= */

export function updateQuorumWeight(
  workId: string,
  newWeight: number
) {
  const admin = getCurrentUser();
  if (!admin || admin.role !== "super_admin") return;

  const works = load();
  const w = works.find((x) => x.id === workId);
  if (!w || w.status !== "pending") return;

  if (w.quorumLocked) return;
  if (newWeight < 1) return;

  w.quorumWeight = newWeight;
  save(works);
}

/* ================= APPROVE ================= */

export async function approveWork(
  workId: string,
  adminWeight = 1,
  proof?: string,
  txHash?: string
) {
  const admin = getCurrentUser();
  if (!admin || admin.role !== "admin") return;

  const works = load();
  const w = works.find((x) => x.id === workId);
  if (!w || w.status !== "pending") return;

  if (w.approvalMap[admin.email]) return;

  const wallet = getActiveAdminWallet(admin.email);
  if (!wallet) return;

  const { signature } =
    await signApproveMessage(wallet.address, workId);

  w.quorumLocked = true;
  w.approvalMap[admin.email] = adminWeight;

  const total = Object.values(w.approvalMap).reduce(
    (a, b) => a + b,
    0
  );

  if (total >= w.quorumWeight) {
    w.status = "verified";
  }

  w.reviews.push({
    admin: admin.email,
    action: "approved",
    time: new Date().toISOString(),
    weight: adminWeight,
    proof,
    signature,
    txHash,
  });

  addReviewLog({
    id: crypto.randomUUID(),
    workId,
    action: "approved",
    admin: admin.email,
    time: new Date().toISOString(),
  });

  save(works);
  window.dispatchEvent(new Event("review-log-updated"));
}

/* ================= REJECT ================= */

export function rejectWork(workId: string, reason: string) {
  const admin = getCurrentUser();
  if (!admin || !["admin", "super_admin"].includes(admin.role))
    return;

  const works = load();
  const w = works.find((x) => x.id === workId);
  if (!w || w.status !== "pending") return;

  w.quorumLocked = true;
  w.status = "rejected";
  w.rejectionBy.push(admin.email);

  w.reviews.push({
    admin: admin.email,
    action: "rejected",
    time: new Date().toISOString(),
    reason,
  });

  addReviewLog({
    id: crypto.randomUUID(),
    workId,
    action: "rejected",
    admin: admin.email,
    time: new Date().toISOString(),
  });

  save(works);
  window.dispatchEvent(new Event("review-log-updated"));
}

/* ================= SUPER ADMIN ================= */

export function superAdminOverride(
  workId: string,
  action: "approve" | "reject",
  reason?: string
) {
  const admin = getCurrentUser();
  if (!admin || admin.role !== "super_admin") return;

  const works = load();
  const w = works.find((x) => x.id === workId);
  if (!w || w.status !== "pending") return;

  w.status = action === "approve" ? "verified" : "rejected";
  w.quorumLocked = true;
  w.overriddenBy = admin.email;
  w.overriddenAt = new Date().toISOString();

  w.reviews.push({
    admin: admin.email,
    action: action === "approve" ? "approved" : "rejected",
    time: new Date().toISOString(),
    reason,
  });

  save(works);
  window.dispatchEvent(new Event("review-log-updated"));
}

/* ================= COMPATIBILITY ALIASES ================= */

/**
 * Alias số nhiều – dùng cho chart / stats
 */
export function getAllWorks(): Work[] {
  return getWorks();
}

/**
 * Alias legacy – code cũ
 */
export function getAllWork(): Work[] {
  return getWorks();
}
