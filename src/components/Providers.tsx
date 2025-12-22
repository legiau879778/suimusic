"use client";

import { ReactNode } from "react";

/* ===================== */
/* REACT QUERY */
/* ===================== */
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

/* ===================== */
/* SUI + WALLET */
/* ===================== */
import {
  SuiClientProvider,
  WalletProvider,
} from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";

/* ===================== */
/* APP CONTEXTS */
/* ===================== */
import { AuthProvider } from "@/context/AuthContext";
import { ModalProvider } from "@/context/ModalContext";
import { ToastProvider } from "@/context/ToastContext";

/* ===================== */
/* CONFIG */
/* ===================== */
const queryClient = new QueryClient();

const networks = {
  devnet: { url: getFullnodeUrl("devnet") },
};

export default function Providers({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider
        networks={networks}
        defaultNetwork="devnet"
      >
        <WalletProvider autoConnect>
          <ToastProvider>
            <AuthProvider>
              <ModalProvider>
                {children}
              </ModalProvider>
            </AuthProvider>
          </ToastProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
