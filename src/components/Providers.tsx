// src/components/Providers.tsx
"use client";

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui.js/client";

import { AuthProvider } from "@/context/AuthContext";
import { ModalProvider } from "@/context/ModalContext";
import { ToastProvider } from "@/context/ToastContext";

import Header from "@/components/Header";
<<<<<<< HEAD
import Footer from "@/components/Footer"; 
=======
import Footer from "@/components/Footer"; // ✅ THÊM DÒNG NÀY
>>>>>>> e1d6e1383e50df77f91295a5cf7e4b97a8024fa7
import AppBootstrap from "@/components/AppBootstrap";

const networks = {
  devnet: { url: getFullnodeUrl("devnet") },
  testnet: { url: getFullnodeUrl("testnet") },
  mainnet: { url: getFullnodeUrl("mainnet") },
};

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="devnet">
        <WalletProvider autoConnect>
          <ToastProvider>
            <AuthProvider>
              <ModalProvider>
                <AppBootstrap />

                <Header />
                {children}
<<<<<<< HEAD
                <Footer /> 
=======
                <Footer /> {/* ✅ THÊM DÒNG NÀY */}
>>>>>>> e1d6e1383e50df77f91295a5cf7e4b97a8024fa7
              </ModalProvider>
            </AuthProvider>
          </ToastProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}