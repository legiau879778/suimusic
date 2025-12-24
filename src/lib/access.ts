import type { Work } from "@/lib/workStore";

/**
 * TRUE nếu:
 * - là owner NFT
 * - hoặc có LicenseNFT hợp lệ
 */
export function hasAccess(params: {
  work: Work;
  wallet?: string;
  nftOwner?: string | null;
  licenses?: any[];
}) {
  const { wallet, nftOwner, licenses, work } = params;

  if (!wallet) return false;

  // OWNER NFT
  if (
    nftOwner &&
    nftOwner.toLowerCase() === wallet.toLowerCase()
  ) {
    return true;
  }

  // LICENSE HOLDER
  if (work.sellType === "license") {
    return (
      licenses &&
      licenses.length > 0
    );
  }

  return false;
}
