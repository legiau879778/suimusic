"use client";

import { useEffect, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";

/**
 * Tổng doanh thu SUI của wallet
 * - State lưu string (MIST)
 * - Convert sang number khi trả ra UI
 */
export function useRevenue(wallet?: string) {
  const suiClient = useSuiClient();

  /* ✅ KHÔNG dùng bigint trong state */
  const [balanceMist, setBalanceMist] =
    useState<string>("0");

  useEffect(() => {
    if (!wallet) {
      setBalanceMist("0");
      return;
    }

    /* re-bind để TS chắc chắn là string */
    const owner: string = wallet;

    let alive = true;

    async function load() {
      try {
        const res = await suiClient.getBalance({
          owner,
          coinType: "0x2::sui::SUI",
        });

        if (!alive) return;

        /* res.totalBalance là string */
        setBalanceMist(res.totalBalance);
      } catch (e) {
        console.error("load revenue error", e);
        if (alive) setBalanceMist("0");
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [wallet, suiClient]);

  return {
    /** SUI (float) – dùng cho UI */
    sui: Number(balanceMist) / 1_000_000_000,
  };
}
