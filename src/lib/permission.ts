import { User } from "@/context/AuthContext";

export function canReview(user: User | null) {
  return (
    user?.role === "reviewer" ||
    user?.role === "admin" ||
    user?.role === "super_admin"
  );
}

export function canManageUsers(user: User | null) {
  return user?.role === "super_admin";
}
