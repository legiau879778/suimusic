export type WalletIdentity = {
  email: string;
  wallet: string;
  role: "user" | "author" | "admin";
  signature: string;
  message: string;
  verifiedAt: number;
};

const KEY = "chainstorm_wallet_identity";

export function saveWalletIdentity(data: WalletIdentity) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getWalletIdentity(): WalletIdentity | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

export function revokeWalletIdentity() {
  localStorage.removeItem(KEY);
}

export function isWalletVerified(email: string) {
  const w = getWalletIdentity();
  return w && w.email === email;
}
