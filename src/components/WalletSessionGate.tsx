"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  useCurrentAccount,
  useCurrentWallet,
  useWallets,
  useConnectWallet,
  useDisconnectWallet,
} from "@mysten/dapp-kit";

import { useAuth } from "@/context/AuthContext";
import { loadProfile } from "@/lib/profileStore";
import { getWalletsByEmail, mapWalletToEmail } from "@/lib/walletMapStore";

function lastWalletKey(userId: string) {
  return `chainstorm_last_wallet:${userId}`;
}

export default function WalletSessionGate() {
  const { user } = useAuth();
  const userId = user?.id || user?.email || "";
  const userEmail = user?.email || "";

  const currentAccount = useCurrentAccount();
  const { isConnected, currentWallet } = useCurrentWallet();
  const wallets = useWallets();
  const { mutateAsync: connect } = useConnectWallet();
  const { mutateAsync: disconnect } = useDisconnectWallet();

  const disconnectingRef = useRef(false);
  const connectingRef = useRef(false);

  const allowedWallets = useMemo(() => {
    if (!userId) return new Set<string>();
    const p = loadProfile(userId);
    const stored = new Set<string>();
    const pAddr = String(p.walletAddress || "").trim();
    if (pAddr) stored.add(pAddr.toLowerCase());

    if (userEmail) {
      for (const w of getWalletsByEmail(userEmail)) {
        stored.add(String(w || "").trim().toLowerCase());
      }
    }
    return stored;
  }, [userEmail, userId]);

  useEffect(() => {
    if (!currentAccount?.address || !userEmail) return;
    mapWalletToEmail(userEmail, currentAccount.address);
  }, [currentAccount?.address, userEmail]);

  useEffect(() => {
    if (disconnectingRef.current || connectingRef.current) return;

    if (!userId) {
      if (isConnected) {
        disconnectingRef.current = true;
        disconnect()
          .catch(() => {})
          .finally(() => {
            disconnectingRef.current = false;
          });
      }
      return;
    }

    if (isConnected && currentAccount?.address) {
      const addr = currentAccount.address.toLowerCase();
      if (allowedWallets.size > 0 && !allowedWallets.has(addr)) {
        disconnectingRef.current = true;
        disconnect()
          .catch(() => {})
          .finally(() => {
            disconnectingRef.current = false;
          });
      }
      return;
    }

    if (!isConnected && wallets.length) {
      const lastWalletName = localStorage.getItem(lastWalletKey(userId));
      if (!lastWalletName) return;
      const wallet = wallets.find((w) => w.name === lastWalletName);
      if (!wallet) return;

      connectingRef.current = true;
      connect({ wallet })
        .catch(() => {
          localStorage.removeItem(lastWalletKey(userId));
        })
        .finally(() => {
          connectingRef.current = false;
        });
    }
  }, [
    userId,
    isConnected,
    currentAccount?.address,
    wallets,
    allowedWallets,
    disconnect,
    connect,
  ]);

  useEffect(() => {
    if (!userId || !currentWallet?.name) return;
    localStorage.setItem(lastWalletKey(userId), currentWallet.name);
  }, [currentWallet?.name, userId]);

  return null;
}
