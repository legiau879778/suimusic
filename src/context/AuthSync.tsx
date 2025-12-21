"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { saveUser, isAdmin } from "@/lib/authStore";

export default function AuthSync() {
  const { data } = useSession();

  useEffect(() => {
    if (data?.user?.email) {
      saveUser({
        email: data.user.email,
        name: data.user.name || "",
        avatar: data.user.image || "",
        role: isAdmin(data.user.email) ? "admin" : "user",
      });
    }
  }, [data]);

  return null;
}
