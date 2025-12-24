"use client";

import { useEffect, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";

/**
 * Đọc tất cả LicenseNFT của 1 wallet
 */
export function useLicenseNFTs(
  wallet?: string,
  packageId?: string
) {
  const suiClient = useSuiClient();

  const [licenses, setLicenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet || !packageId) {
      setLicenses([]);
      return;
    }

    /* ✅ re-bind để TS chắc chắn là string */
    const owner: string = wallet;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);

        const objects =
          await suiClient.getOwnedObjects({
            owner, // ✅ string
            options: {
              showContent: true,
              showType: true,
            },
          });

        if (cancelled) return;

        const licenseNFTs =
          objects.data
            .filter((o) =>
              o.data?.type?.includes(
                `${packageId}::chainstorm_nft::LicenseNFT`
              )
            )
            .map((o) => o.data);

        setLicenses(licenseNFTs);
      } catch (e) {
        console.error("load license nft error", e);
        if (!cancelled) setLicenses([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [wallet, packageId, suiClient]);

  return { licenses, loading };
}
