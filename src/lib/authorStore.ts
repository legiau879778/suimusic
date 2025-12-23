import { safeLoad, safeSave } from "./storage";

/* ================= STORAGE ================= */

const STORAGE_KEY = "chainstorm_authors";

/* ================= TYPES ================= */

export type AuthorStatus = "pending" | "approved" | "rejected";

export type Author = {
  id: string;              // user.id
  name: string;
  stageName: string;
  birthDate: string;
  nationality: string;
  status: AuthorStatus;

  walletAddress?: string;   // 🔗 ví blockchain
  membershipNftId?: string; // 🪙 NFT thành viên

  createdAt: string;
  updatedAt: string;
};

/* ================= INTERNAL ================= */

function load(): Author[] {
  return safeLoad<Author[]>(STORAGE_KEY) || [];
}

function save(data: Author[]) {
  safeSave(STORAGE_KEY, data);
}

/* ================= GETTERS ================= */

/** 🔐 Admin: xem toàn bộ author */
export function getAllAuthors(): Author[] {
  return load();
}

/** 🌍 Public: chỉ author đã duyệt */
export function getApprovedAuthors(): Author[] {
  return load().filter(a => a.status === "approved");
}

/** 🔎 Lấy author theo id (admin/internal) */
export function getAuthorById(
  id: string
): Author | null {
  return load().find(a => a.id === id) || null;
}

/** 🌍 Public-safe */
export function getApprovedAuthorById(
  id: string
): Author | null {
  const a = getAuthorById(id);
  return a && a.status === "approved" ? a : null;
}

/** ⏳ Admin: danh sách chờ duyệt */
export function getPendingAuthors(): Author[] {
  return load().filter(a => a.status === "pending");
}

/* ================= MUTATIONS ================= */

/**
 * ✅ Upsert author profile
 * - Dùng khi user đăng ký tác phẩm / cập nhật profile
 * - KHÔNG reset status nếu đã tồn tại
 */
export function upsertAuthor(data: {
  id: string; // user.id
  name: string;
  stageName: string;
  birthDate: string;
  nationality: string;
}) {
  const authors = load();
  const now = new Date().toISOString();

  const existing = authors.find(a => a.id === data.id);

  if (existing) {
    existing.name = data.name;
    existing.stageName = data.stageName;
    existing.birthDate = data.birthDate;
    existing.nationality = data.nationality;
    existing.updatedAt = now;
  } else {
    authors.push({
      ...data,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }

  save(authors);
}

/**
 * ❌ Chỉ dùng nếu bạn MUỐN tạo author thủ công (admin)
 * ⚠️ Không khuyến nghị cho flow user
 */
export function addAuthor(data: {
  id: string;
  name: string;
  stageName: string;
  birthDate: string;
  nationality: string;
}) {
  const authors = load();
  const now = new Date().toISOString();

  if (authors.some(a => a.id === data.id)) {
    return { error: "AUTHOR_EXISTS" as const };
  }

  authors.push({
    ...data,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  save(authors);
  return { ok: true };
}

/* ================= REVIEW ================= */

/** ✅ Admin duyệt author */
export function approveAuthor(authorId: string) {
  save(
    load().map(a =>
      a.id === authorId
        ? {
            ...a,
            status: "approved",
            updatedAt: new Date().toISOString(),
          }
        : a
    )
  );
}

/** ❌ Admin từ chối */
export function rejectAuthor(authorId: string) {
  save(
    load().map(a =>
      a.id === authorId
        ? {
            ...a,
            status: "rejected",
            updatedAt: new Date().toISOString(),
          }
        : a
    )
  );
}

/* ================= WEB3 ================= */

/** 🔗 Gắn ví cho author */
export function bindAuthorWallet(
  authorId: string,
  walletAddress: string
) {
  save(
    load().map(a =>
      a.id === authorId
        ? {
            ...a,
            walletAddress,
            updatedAt: new Date().toISOString(),
          }
        : a
    )
  );
}

/** 🪙 Gán NFT thành viên */
export function setAuthorMembershipNFT(
  authorId: string,
  nftId: string
) {
  save(
    load().map(a =>
      a.id === authorId
        ? {
            ...a,
            membershipNftId: nftId,
            updatedAt: new Date().toISOString(),
          }
        : a
    )
  );
}

/* ================= STATS ================= */

/** 📊 Thống kê author đã duyệt */
export function countApprovedAuthors(): number {
  return load().filter(a => a.status === "approved").length;
}
