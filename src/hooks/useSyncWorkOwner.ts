"use client";

import { useEffect, useRef } from "react";
import { useNFTOwnership } from "./useNFTOwnership";
import { updateNFTOwner } from "@/lib/workStore";

/**
 * Auto sync owner on-chain -> local store.authorWallet
 */
export function useSyncWorkOwner(params: { workId: string; nftObjectId?: string }) {
  const { owner } = useNFTOwnership(params.nftObjectId);
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!params.workId || !owner) return;
    if (last.current?.toLowerCase() === owner.toLowerCase()) return;

    last.current = owner;
    updateNFTOwner({ workId: params.workId, newOwner: owner });
  }, [owner, params.workId]);

  return { owner };
}
