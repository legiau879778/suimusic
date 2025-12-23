"use client";

import { useAuth } from "@/context/AuthContext";

export default function AdminGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!user || user.role !== "admin") {
    return <div>🚫 Forbidden</div>;
  }
  return <>{children}</>;
}
