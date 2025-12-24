export function generateLegalProof(work: any) {
  return {
    title: work.title,
    hash: work.hash,
    nft: work.nftObjectId,
    owner: work.authorWallet,
    tx: work.txDigest,
    timestamp: work.mintedAt,
  };
}
