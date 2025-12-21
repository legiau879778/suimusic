"use client";

import { createContext, useContext, useState } from "react";
import LoginModal from "@/components/LoginModal";

type Ctx = {
  openLogin: () => void;
  closeLogin: () => void;
};

const LoginModalContext = createContext<Ctx | null>(null);

export function LoginModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <LoginModalContext.Provider
      value={{
        openLogin: () => setOpen(true),
        closeLogin: () => setOpen(false),
      }}
    >
      {children}
      <LoginModal open={open} onClose={() => setOpen(false)} />
    </LoginModalContext.Provider>
  );
}

export function useLoginModal() {
  const ctx = useContext(LoginModalContext);
  if (!ctx)
    throw new Error("useLoginModal must be inside provider");
  return ctx;
}
