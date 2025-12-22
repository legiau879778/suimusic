// lib/walletStore.ts
type WalletMap = Record<
  string,
  {
    address: string;
    verified: boolean;
    time: number;
  }
>;

const KEY = "chainstorm_wallet_map";

function load(): WalletMap {
  return JSON.parse(localStorage.getItem(KEY) || "{}");
}

function save(data: WalletMap) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function saveUserWallet(
  userId: string,
  wallet: { address: string; verified: boolean }
) {
  const data = load();
  data[userId] = {
    ...wallet,
    time: Date.now(),
  };
  save(data);
}

export function removeUserWallet(userId: string) {
  const data = load();
  delete data[userId];
  save(data);
}

export function getUserWallet(userId: string) {
  return load()[userId];
}
