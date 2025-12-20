export type User = {
  username: string;
  role: "user" | "admin";
  authorId?: string;
};

const KEY = "auth_user";

export function login(username: string) {
  const user: User = {
    username,
    role: username === "admin" ? "admin" : "user",
  };
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem(KEY);
}
