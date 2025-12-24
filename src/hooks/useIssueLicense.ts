import { useEffect, useState } from "react";
import { useCurrentWallet } from "@mysten/dapp-kit";
import { SuiClient } from "@mysten/sui/client";

/* ================= CONFIG ================= */

const RPC_URL = "https://fullnode.mainnet.sui.io";
const suiClient = new SuiClient({ url: RPC_URL });

/* ================= TYPES ================= */

export type LicenseNFT = {
  objectId: string;
  type: string;
  content: any;
};

/* ================= HOOK ================= */

export function useLicensesNFTs() {
  const { currentWallet, isConnected } = useCurrentWallet();
  const wallet =
    currentWallet?.accounts?.[0]?.address;

  const [licenses, setLicenses] = useState<LicenseNFT[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    null
  );

  useEffect(() => {
    async function load() {
      /* ✅ GUARD: wallet bắt buộc phải tồn tại */
      if (!isConnected || !wallet) {
        setLicenses([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const objects =
          await suiClient.getOwnedObjects({
            owner: wallet, // ✅ giờ chắc chắn là string
            options: {
              showContent: true,
              showType: true,
            },
          });

        const licenses: LicenseNFT[] =
          objects.data
            .filter(
              (o) =>
                o.data?.type?.includes(
                  "LicenseNFT"
                )
            )
            .map((o) => ({
              objectId: o.data!.objectId,
              type: o.data!.type!,
              content: o.data!.content,
            }));

        setLicenses(licenses);
      } catch (e: any) {
        console.error(e);
        setError(
          e?.message ??
            "Không thể tải License NFTs"
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [wallet, isConnected]);

  return {
    licenses,
    loading,
    error,
  };
}
