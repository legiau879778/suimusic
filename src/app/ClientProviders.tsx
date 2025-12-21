"use client";

import { SessionProvider } from "next-auth/react";
import { LoginModalProvider } from "@/context/LoginModalContext";
import AuthSync from "@/context/AuthSync";

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <LoginModalProvider>
        <AuthSync />
        {children}
      </LoginModalProvider>
    </SessionProvider>
  );
}
