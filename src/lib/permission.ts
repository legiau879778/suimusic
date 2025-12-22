import { User } from "@/context/AuthContext";

export function canReview(user: User | null) {
  return user?.role === "admin";
}


export function canManageUsers(user: User | null) {
  return user?.role === "admin";
}
