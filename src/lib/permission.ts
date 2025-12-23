import { User } from "@/context/AuthContext";
import type { Work } from "./workStore";

/* ================= ADMIN PERMISSION ================= */

export function canReview(user: User | null) {
  return user?.role === "admin";
}

export function canManageUsers(user: User | null) {
  return user?.role === "admin";
}

export function canViewAuditLog(user: User | null) {
  return user?.role === "admin";
}

/* ================= WORK PERMISSION (ATOMIC) ================= */

export function canDeleteWork(
  user: User | null,
  work: Work
) {
  if (!user) return false;
  return (
    user.role === "admin" ||
    work.authorId === user.id
  );
}

export function canRestoreWork(
  user: User | null,
  work: Work
) {
  if (!user) return false;
  return (
    user.role === "admin" ||
    work.authorId === user.id
  );
}

export function canEditWork(
  user: User | null,
  work: Work
) {
  if (!user) return false;
  if (user.role === "admin") return false;
  return (
    work.authorId === user.id &&
    work.status === "rejected"
  );
}

/* ================= GENERIC CAN (🔥 QUAN TRỌNG) ================= */

/**
 * Wrapper dùng cho UI:
 * can(user, "delete", work)
 * can(user, "restore", work)
 * can(user, "edit", work)
 */
export type PermissionAction =
  | "delete"
  | "restore"
  | "edit";

export function can(
  user: User | null,
  action: PermissionAction,
  work: Work
) {
  switch (action) {
    case "delete":
      return canDeleteWork(user, work);
    case "restore":
      return canRestoreWork(user, work);
    case "edit":
      return canEditWork(user, work);
    default:
      return false;
  }
}
