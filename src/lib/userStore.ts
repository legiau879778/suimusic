// src/lib/userStore.ts

export type UserRecord = {
  id: string;
  email: string;
  role: "user" | "author" | "admin";
};

const KEY = "chainstorm_users";

function safeLoad(): UserRecord[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(KEY) || "[]");
}

function safeSave(data: UserRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getUsers(): UserRecord[] {
  return safeLoad();
}

export function setRole(id: string, role: UserRecord["role"]) {
  const users = safeLoad();
  const u = users.find(x => x.id === id);
  if (!u) return;

  u.role = role;
  safeSave(users);
}
