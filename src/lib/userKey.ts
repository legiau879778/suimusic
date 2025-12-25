// src/lib/userKey.ts
import type { User } from "@/context/AuthContext";

export function getUserKey(user: User | null | undefined) {
  // Ưu tiên id (Google sub) vì ổn định nhất
  const id = user?.id?.trim();
  if (id) return id;

  // fallback email (nếu có)
  const email = user?.email?.trim();
  if (email) return email;

  return "guest";
}
