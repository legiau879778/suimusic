export type Role = "user" | "admin";

export type User = {
  email: string;
  name?: string;
  avatar?: string;
  role: Role;
};

const AUTH_KEY = "CHAINSTORM_AUTH";

/* EMAIL ADMIN (TẠM – CÓ THỂ ĐƯA RA ENV) */
const ADMIN_EMAILS = ["legiau879778@gmail.com"];

export function saveUser(user: User) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
}

/* UTILS */
export function isAdmin(email?: string | null) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email);
}
