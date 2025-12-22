export type WalletMap = {
  email: string;
  wallets: string[];
};

const KEY = "chainstorm_wallet_map";

function load(): WalletMap[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function save(data: WalletMap[]) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

/* 🔗 GET WALLET BY EMAIL */
export function getWalletsByEmail(email: string): string[] {
  return load().find(x => x.email === email)?.wallets || [];
}

/* ➕ MAP WALLET */
export function mapWalletToEmail(email: string, wallet: string) {
  const data = load();
  const item = data.find(x => x.email === email);

  if (item) {
    if (!item.wallets.includes(wallet)) {
      item.wallets.push(wallet);
    }
  } else {
    data.push({ email, wallets: [wallet] });
  }

  save(data);
}

/* ❌ REVOKE WALLET */
export function revokeWallet(email: string, wallet: string) {
  const data = load();
  const item = data.find(x => x.email === email);
  if (!item) return;

  item.wallets = item.wallets.filter(w => w !== wallet);
  save(data);
}
