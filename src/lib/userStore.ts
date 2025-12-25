// src/lib/userStore.ts
export type UserRole = "user" | "author" | "admin";

export type User = {
  id: string;
  email: string;
  role: UserRole;

  wallet?: {
    address: string;
    verified?: boolean;
  };

  createdAt: number;
};

const KEY = "chainstorm_users";
export const USERS_UPDATED_EVENT = "users_updated";

/* ================= SAFE STORAGE ================= */

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function emitUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(USERS_UPDATED_EVENT));
}

function load(): User[] {
  if (typeof window === "undefined") return [];
  const arr = safeParse<User[]>(localStorage.getItem(KEY), []);
  return Array.isArray(arr) ? arr : [];
}

function save(users: User[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(users));
  emitUpdated();
}

/* ================= API ================= */

export function getUsers(): User[] {
  return load();
}

export function upsertUser(u: Omit<User, "createdAt"> & { createdAt?: number }) {
  const users = load();
  const idx = users.findIndex((x) => x.id === u.id);

  if (idx >= 0) {
    const prev = users[idx];
    users[idx] = {
      ...prev,
      ...u,
      createdAt: prev.createdAt || u.createdAt || Date.now(), // ✅ giữ createdAt cũ
    };
  } else {
    users.unshift({
      ...u,
      createdAt: u.createdAt || Date.now(),
    } as User);
  }

  save(users);
}

export function updateUserRole(id: string, role: User["role"]) {
  const users = load();
  const idx = users.findIndex((x) => x.id === id);
  if (idx < 0) return;

  users[idx] = { ...users[idx], role };
  save(users);
}

export function subscribeUsers(cb: () => void) {
  if (typeof window === "undefined") return () => {};

  const onEvent = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };

  window.addEventListener(USERS_UPDATED_EVENT, onEvent);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(USERS_UPDATED_EVENT, onEvent);
    window.removeEventListener("storage", onStorage);
  };
}
