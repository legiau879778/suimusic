export type ProofStatus =
  | "submitted"
  | "tsa_attested"
  | "approved"
  | "rejected";

export type ProofTsa = {
  id: string;
  signature: string;
  time: string;
  mock?: boolean;
};

export type ProofApproval = {
  adminWallet: string;
  signature: string;
  time: string;
  mock?: boolean;
};

export type ProofRecord = {
  id: string;
  createdAt: string;
  status: ProofStatus;

  authorId: string;
  wallet: string;

  fileHash: string;
  metaHash: string;

  walrusFileId: string;
  walrusMetaId: string;
  walrusCoverId?: string;

  message: string;
  authorSignature: string;
  signatureVerified?: boolean;
  signatureVerifyReason?: string;

  metadata: Record<string, any>;

  tsa?: ProofTsa;
  approval?: ProofApproval;
};
