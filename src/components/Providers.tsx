"use client";

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SuiClientProvider, WalletProvider, createNetworkConfig } from "@mysten/dapp-kit"; // Thêm createNetworkConfig
import { getFullnodeUrl } from "@mysten/sui.js/client";

import { AuthProvider } from "@/context/AuthContext";
import { ModalProvider } from "@/context/ModalContext";
import { ToastProvider } from "@/context/ToastContext";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AppBootstrap from "@/components/AppBootstrap";
import WalletSessionGate from "@/components/WalletSessionGate";

// Cấu hình mạng ổn định hơn
const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl("testnet") },
  mainnet: { url: getFullnodeUrl("mainnet") },
  devnet: { url: getFullnodeUrl("devnet") },
});

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {/* 🟢 SỬA TẠI ĐÂY: Đổi defaultNetwork từ devnet sang testnet */}
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          <ToastProvider>
            <AuthProvider>
              <ModalProvider>
                <AppBootstrap />
                <WalletSessionGate />

                <Header />
                {children}
                <Footer />
              </ModalProvider>
            </AuthProvider>
          </ToastProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
