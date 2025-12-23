import { safeLoad, safeSave } from "./storage";
import { addReviewLog } from "./reviewLogStore";
import { signApproveAuthorMessage } from "./signApproveAuthorMessage";
import type { UserRole } from "@/context/AuthContext";

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

export type WorkStatus =
  | "pending"
  | "verified"
  | "rejected";

export type MarketStatus =
  | "private"
  | "public"
  | "tradeable";

export type Work = {
  id: string;
  title: string;
  authorId: string;
  hash?: string;

  status: WorkStatus;
  marketStatus?: MarketStatus;

  quorumWeight: number;
  quorumLocked: boolean;

  approvalMap: Record<string, number>; // key = admin wallet address
  rejectionBy: string[];
  reviews: ReviewItem[];

  verifiedAt?: string;
  rejectedAt?: string;
};

/* ================= INTERNAL ================= */

function load(): Work[] {
  return safeLoad<Work[]>(STORAGE_KEY) || [];
}

function save(data: Work[]) {
  safeSave(STORAGE_KEY, data);
}

/* ================= GETTERS ================= */

export function getWorks(): Work[] {
  return load();
}

export function getPendingWorks(): Work[] {
  return load().filter(
    (w) => w.status === "pending"
  );
}

export function getWorksByAuthor(authorId: string): Work[] {
  return load().filter(
    (w) => w.authorId === authorId
  );
}

/* ================= AUTHOR ================= */

export function addWork(data: {
  title: string;
  authorId: string;
  hash?: string;
  marketStatus?: MarketStatus;
}) {
  const works = load();

  works.push({
    id: crypto.randomUUID(),
    title: data.title,
    authorId: data.authorId,
    hash: data.hash,

    status: "pending",
    marketStatus:
      data.marketStatus || "private",

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
  const works = load();
  const w = works.find(
    (x) => x.id === workId
  );
  if (
    !w ||
    w.status !== "pending" ||
    w.quorumLocked
  )
    return;

  if (newWeight < 1) return;

  w.quorumWeight = newWeight;
  save(works);
}

/* ================= APPROVE (SUI) ================= */

export async function approveWork(params: {
  workId: string;
  admin: { email: string; role: UserRole };
  adminWeight?: number;
  proof?: string;
  txHash?: string;
}) {
  const {
    workId,
    admin,
    adminWeight = 1,
    proof,
    txHash,
  } = params;

  const works = load();
  const w = works.find(
    (x) => x.id === workId
  );
  if (!w || w.status !== "pending")
    return;

  w.approvalMap ||= {};
  w.reviews ||= [];
  w.rejectionBy ||= [];

  // 🔐 Admin ký bằng ví SUI
  const {
    signature,
    adminWallet,
  } = await signApproveAuthorMessage(workId);

  // ❌ đã approve bằng ví này
  if (w.approvalMap[adminWallet])
    return;

  w.approvalMap[adminWallet] =
    adminWeight;

  const totalWeight = Object.values(
    w.approvalMap
  ).reduce((a, b) => a + b, 0);

  if (totalWeight >= w.quorumWeight) {
    w.status = "verified";
    w.verifiedAt =
      new Date().toISOString();
    w.quorumLocked = true;
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
    workTitle: w.title,
    action: "approved",
    adminEmail: admin.email,
    adminRole: admin.role,
    time: new Date().toISOString(),
  });

  save(works);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new Event("review-log-updated")
    );
  }
}

/* ================= REJECT ================= */

export function rejectWork(params: {
  workId: string;
  admin: { email: string; role: UserRole };
  reason: string;
}) {
  const { workId, admin, reason } =
    params;

  const works = load();
  const w = works.find(
    (x) => x.id === workId
  );
  if (!w || w.status !== "pending")
    return;

  w.quorumLocked = true;
  w.status = "rejected";
  w.rejectedAt =
    new Date().toISOString();
  w.rejectionBy ||= [];
  w.rejectionBy.push(admin.email);

  w.reviews ||= [];
  w.reviews.push({
    admin: admin.email,
    action: "rejected",
    time: new Date().toISOString(),
    reason,
  });

  addReviewLog({
    id: crypto.randomUUID(),
    workId,
    workTitle: w.title,
    action: "rejected",
    adminEmail: admin.email,
    adminRole: admin.role,
    time: new Date().toISOString(),
  });

  save(works);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new Event("review-log-updated")
    );
  }
}

/* ================= COUNT ================= */

export function countWorksByAuthor(
  authorId: string
): number {
  return load().filter(
    (w) => w.authorId === authorId
  ).length;
}
