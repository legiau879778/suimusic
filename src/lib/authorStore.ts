export type AuthorStatus = "pending" | "approved" | "rejected";

export type Author = {
  id: string;
  name: string;
  stageName: string;
  birthDate: string;
  nationality: string;
  status: AuthorStatus;

  walletAddress?: string;   // 🔗 gắn ví
  membershipNftId?: string; // 🪙 NFT
};

const KEY = "chainstorm_authors";

/* ===================== */
/* SAFE STORAGE */
/* ===================== */

function load(): Author[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function save(data: Author[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(data));
}

/* ===================== */
/* GETTERS */
/* ===================== */

export function getAuthors(): Author[] {
  return load();
}

export function getAllAuthors(): Author[] {
  return load();
}

export function getAuthorById(id: string): Author | null {
  return load().find(a => a.id === id) || null;
}

export function getApprovedAuthorById(id: string): Author | null {
  const a = getAuthorById(id);
  return a && a.status === "approved" ? a : null;
}

export function getPendingAuthors(): Author[] {
  return load().filter(a => a.status === "pending");
}

/* ===================== */
/* MUTATIONS */
/* ===================== */

export function addAuthor(data: {
  name: string;
  stageName: string;
  birthDate: string;
  nationality: string;
}) {
  const authors = load();

  authors.push({
    id: crypto.randomUUID(),
    name: data.name,
    stageName: data.stageName,
    birthDate: data.birthDate,
    nationality: data.nationality,
    status: "pending",
  });

  save(authors);
}

/**
 * ✅ Admin duyệt author (logic domain)
 * Ký ví + log làm ở layer cao hơn
 */
export function approveAuthor(id: string) {
  save(
    load().map(a =>
      a.id === id
        ? { ...a, status: "approved" }
        : a
    )
  );
}

export function rejectAuthor(id: string) {
  save(
    load().map(a =>
      a.id === id
        ? { ...a, status: "rejected" }
        : a
    )
  );
}

/**
 * 🔗 Gắn ví cho author (sau khi author login + connect ví)
 */
export function bindAuthorWallet(
  authorId: string,
  walletAddress: string
) {
  save(
    load().map(a =>
      a.id === authorId
        ? { ...a, walletAddress }
        : a
    )
  );
}

/**
 * 🪙 Mint membership NFT (mock / on-chain sau)
 */
export function setAuthorMembershipNFT(
  authorId: string,
  nftId: string
) {
  save(
    load().map(a =>
      a.id === authorId
        ? { ...a, membershipNftId: nftId }
        : a
    )
  );
}

/* ===================== */
/* STATS */
/* ===================== */

export function countApprovedAuthors(): number {
  return load().filter(a => a.status === "approved").length;
}
