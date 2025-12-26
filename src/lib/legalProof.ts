export function generateLegalProof(work: any) {
  return {
    title: work.title,
    hash: work.hash,
    fileHash: work.fileHash,
    metaHash: work.metaHash,
    walrusFileId: work.walrusFileId,
    walrusMetaId: work.walrusMetaId,
    walrusCoverId: work.walrusCoverId,
    proofId: work.proofId,
    authorSignature: work.authorSignature,
    tsaId: work.tsaId,
    tsaSignature: work.tsaSignature,
    tsaTime: work.tsaTime,
    approvalSignature: work.approvalSignature,
    approvalWallet: work.approvalWallet,
    approvalTime: work.approvalTime,
    nft: work.nftObjectId,
    owner: work.authorWallet,
    tx: work.txDigest,
    timestamp: work.mintedAt,
  };
}
