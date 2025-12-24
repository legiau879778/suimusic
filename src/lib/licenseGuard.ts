import type { Work } from "./workStore";

/**
 * Kiểm tra wallet có quyền dùng work hay không
 */
export function hasUsageRight(params: {
  work: Work;
  wallet?: string;
  licenseNFTs: any[];
  currentEpoch: number;
}) {
  const { work, wallet, licenseNFTs, currentEpoch } =
    params;

  if (!wallet) return false;

  // ✅ owner WorkNFT
  if (
    wallet.toLowerCase() ===
    work.authorWallet?.toLowerCase()
  ) {
    return true;
  }

  // ✅ license NFT hợp lệ
  for (const l of licenseNFTs) {
    const fields =
      (l as any)?.content?.fields;
    if (!fields) continue;

    if (
      fields.work_nft === work.nftObjectId
    ) {
      const expire =
        Number(fields.expire_epoch);

      if (
        expire === 0 ||
        expire > currentEpoch
      ) {
        return true;
      }
    }
  }

  return false;
}
