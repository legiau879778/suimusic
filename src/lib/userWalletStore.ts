export type UserWallet = {
  userId: string;
  email: string;
  wallet: string;
  connectedAt: number;
};

function key(userId: string) {
  return `profile_wallet_${userId}`;
}

export function getUserWallet(userId: string): UserWallet | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveUserWallet(data: UserWallet) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(data.userId), JSON.stringify(data));
}

export function revokeUserWallet(userId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key(userId));
}
