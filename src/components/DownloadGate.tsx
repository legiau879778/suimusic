"use client";

import { ReactNode } from "react";
import {
  useCurrentAccount,
  useSuiClient,
} from "@mysten/dapp-kit";
import { useToast } from "@/context/ToastContext";

/* ================= TYPES ================= */

export default function DownloadGate({
  children,
  onDownload,
}: {
  children: ReactNode;
  onDownload: () => void;
}) {
  const currentAccount = useCurrentAccount(); // ✅ FIX
  const suiClient = useSuiClient();
  const { showToast } = useToast();

  /* ================= HANDLER ================= */

  async function handleDownload() {
    if (!currentAccount) {
      showToast("Please connect your wallet to download", "warning");
      return;
    }

    try {
      // (optional) nếu bạn muốn kiểm tra on-chain trước khi cho tải
      // const epoch = await suiClient.getLatestSuiSystemState();

      onDownload();
    } catch (e) {
      console.error(e);
      showToast("Không thể tải file", "error");
    }
  }

  /* ================= RENDER ================= */

  return (
    <div
      onClick={handleDownload}
      style={{ cursor: "pointer", display: "inline-block" }}
    >
      {children}
    </div>
  );
}
