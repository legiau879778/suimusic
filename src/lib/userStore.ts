export type User = {
  id: string;
  email: string;
  role: "user" | "author" | "admin";
  wallet?: string;
  createdAt: number;
};

const KEY = "chainstorm_users";

/* ================= SAFE STORAGE ================= */

function load(): User[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(
      localStorage.getItem(KEY) || "[]"
    );
  } catch {
    return [];
  }
}

function save(users: User[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(users));
}

/* ================= API ================= */

export function getUsers(): User[] {
  return load();
}

export function updateUserRole(
  id: string,
  role: User["role"]
) {
  const users = load();
  const u = users.find((x) => x.id === id);
  if (!u) return;

  u.role = role;
  save(users);
}
