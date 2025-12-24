import { useEffect, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { updateNFTOwner } from "./workStore";

/**
 * 🔗 Hook đọc owner NFT + sync vào store
 */
export function useNFTOwner(params: {
  workId: string;
  nftObjectId?: string;
}) {
  const { workId, nftObjectId } = params;
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

    let cancelled = false;

    async function fetchOwner() {
      try {
        setLoading(true);

        const obj = await suiClient.getObject({
          id, // ✅ string
          options: { showOwner: true },
        });

        if (cancelled) return;

        const ownerField = obj.data?.owner;
        const ownerAddress =
          ownerField &&
          typeof ownerField === "object" &&
          "AddressOwner" in ownerField
            ? ownerField.AddressOwner
            : null;

        if (ownerAddress) {
          setOwner(ownerAddress);

          updateNFTOwner({
            workId,
            newOwner: ownerAddress,
          });
        }
      } catch (e) {
        console.error("fetch NFT owner failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchOwner();

    return () => {
      cancelled = true;
    };
  }, [nftObjectId, workId, suiClient]);

  return { owner, loading };
}
