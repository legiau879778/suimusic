"use client";

import { useEffect, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";

export function useSuiEpoch() {
  const suiClient = useSuiClient();
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    suiClient
      .getLatestSuiSystemState()
      .then(s => setEpoch(Number(s.epoch)))
      .catch(() => setEpoch(0));
  }, [suiClient]);

  return epoch;
}
