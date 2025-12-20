export type AuthorStatus = "pending" | "approved" | "rejected";

export type Author = {
  id: string;
  name: string;        // tên thật
  stageName: string;   // nghệ danh
  birthDate: string;   // YYYY-MM-DD
  nationality: string;
  status: AuthorStatus;
};

const KEY = "authors";

/* ===== SAFE STORAGE ===== */
function safeLoad(): Author[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function safeSave(data: Author[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(data));
}

/* ===== EXPORTS ===== */
export function getAuthors(): Author[] {
  return safeLoad();
}

export function getAuthorById(id: string): Author | null {
  return safeLoad().find(a => a.id === id) || null;
}

export function getApprovedAuthorById(id: string): Author | null {
  const a = getAuthorById(id);
  return a && a.status === "approved" ? a : null;
}

export function addAuthor(data: {
  name: string;
  stageName: string;
  birthDate: string;
  nationality: string;
}) {
  const authors = safeLoad();

  authors.push({
    id: "AUTH-" + Date.now(),
    name: data.name,
    stageName: data.stageName,
    birthDate: data.birthDate,
    nationality: data.nationality,
    status: "pending",
  });

  safeSave(authors);
}

export function approveAuthor(id: string) {
  safeSave(
    safeLoad().map(a =>
      a.id === id ? { ...a, status: "approved" } : a
    )
  );
}

export function rejectAuthor(id: string) {
  safeSave(
    safeLoad().map(a =>
      a.id === id ? { ...a, status: "rejected" } : a
    )
  );
}
