"use client";

import { useEffect, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";

export function useNFTOwnership(nftObjectId?: string) {
  const suiClient = useSuiClient();

  const [owner, setOwner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!nftObjectId) {
      setOwner(null);
      return;
    }

    /* ✅ re-bind để TS chắc chắn là string */
    const id: string = nftObjectId;

    let alive = true;

    async function sync() {
      try {
        setLoading(true);

        const obj = await suiClient.getObject({
          id, // ✅ string
          options: { showOwner: true },
        });

        if (!alive) return;

        const ownerField = obj.data?.owner;

        const address =
          ownerField &&
          typeof ownerField === "object" &&
          "AddressOwner" in ownerField
            ? ownerField.AddressOwner
            : null;

        setOwner(address);
      } catch (e) {
        console.error("get owner failed", e);
        if (alive) setOwner(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    sync();
    const timer = setInterval(sync, 8000);

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [nftObjectId, suiClient]);

  return { owner, loading };
}
