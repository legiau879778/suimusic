// src/lib/adminWalletStore.ts
export type AdminWallet = {
  email: string;
  address: string;
  connectedAt: string;
  active: boolean;
};

const KEY = "CHAINSTORM_ADMIN_WALLETS";

const load = (): AdminWallet[] => {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(KEY) || "[]");
};

const save = (data: AdminWallet[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(data));
};

export function getAdminWallets(email: string): AdminWallet[] {
  return load().filter(w => w.email === email);
}

export function getActiveAdminWallet(email: string) {
  return getAdminWallets(email).find(w => w.active);
}

export function connectAdminWallet(email: string, address: string) {
  const wallets = load();

  // deactivate old wallets
  wallets.forEach(w => {
    if (w.email === email) w.active = false;
  });

  wallets.push({
    email,
    address,
    connectedAt: new Date().toISOString(),
    active: true,
  });

  save(wallets);
}

export function disconnectAdminWallet(email: string, address: string) {
  const wallets = load().filter(
    w => !(w.email === email && w.address === address)
  );
  save(wallets);
}
