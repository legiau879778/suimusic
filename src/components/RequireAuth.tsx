"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/authStore";
import { useLoginModal } from "@/context/LoginModalContext";

export default function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { openLogin } = useLoginModal();

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      openLogin();
      router.push("/");
    }
  }, []);

  return <>{children}</>;
}
