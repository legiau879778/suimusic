import { User } from "@/context/AuthContext";

const AUTH_KEY = "auth_user";

/* ===================== */
/* STORAGE */
/* ===================== */

export function loadUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveUser(user: User) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export function clearUser() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_KEY);
}
