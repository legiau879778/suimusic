export type AuthorStatus = "pending" | "approved" | "rejected";

export type Author = {
  id: string;
  name: string;        // tên thật
  stageName: string;   // nghệ danh
  birthDate: string;   // YYYY-MM-DD
  nationality: string;
  status: AuthorStatus;
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

/** Alias – cho thống nhất với workStore */
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

export function approveAuthor(id: string) {
  const authors = load();

  save(
    authors.map(a =>
      a.id === id
        ? { ...a, status: "approved" as const }
        : a
    )
  );
}

export function rejectAuthor(id: string) {
  const authors = load();

  save(
    authors.map(a =>
      a.id === id
        ? { ...a, status: "rejected" as const }
        : a
    )
  );
}

/* ===================== */
/* STATS / HELPERS */
/* ===================== */

export function countApprovedAuthors(): number {
  return load().filter(a => a.status === "approved").length;
}
