export type AdminWallet = {
  email: string;
  address: string;
  weight: number;
  addedAt: string;
  active?: boolean;
};

const STORAGE_KEY = "admin_wallets";

/* ================= LOAD / SAVE ================= */

function load(): AdminWallet[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function save(data: AdminWallet[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* ================= ADD ================= */

export function addAdminWallet(
  email: string,
  address: string,
  weight = 1
) {
  const wallets = load();

  if (
    wallets.some(
      (w) =>
        w.email === email &&
        w.address.toLowerCase() === address.toLowerCase()
    )
  ) {
    return;
  }

  const isFirst =
    wallets.filter((w) => w.email === email).length === 0;

  wallets.push({
    email,
    address,
    weight,
    addedAt: new Date().toISOString(),
    active: isFirst,
  });

  save(wallets);
}

/* ================= GET ================= */

export function getAdminWallets(email: string): AdminWallet[] {
  return load().filter((w) => w.email === email);
}

export function getActiveAdminWallet(email: string) {
  return getAdminWallets(email).find((w) => w.active);
}

export function isAdminWallet(address: string): boolean {
  return load().some(
    (w) => w.address.toLowerCase() === address.toLowerCase()
  );
}

/* ================= SET ACTIVE ================= */

export function setActiveAdminWallet(
  email: string,
  address: string
) {
  const wallets = load().map((w) => {
    if (w.email !== email) return w;

    return {
      ...w,
      active:
        w.address.toLowerCase() === address.toLowerCase(),
    };
  });

  save(wallets);
}

/* ================= REMOVE / REVOKE ================= */

export function removeAdminWallet(
  email: string,
  address: string
) {
  let wallets = load();

  const removed = wallets.find(
    (w) =>
      w.email === email &&
      w.address.toLowerCase() === address.toLowerCase()
  );

  wallets = wallets.filter(
    (w) =>
      !(
        w.email === email &&
        w.address.toLowerCase() === address.toLowerCase()
      )
  );

  // ⚠️ nếu xoá wallet active → auto set wallet khác active
  if (removed?.active) {
    const remaining = wallets.filter(
      (w) => w.email === email
    );

    if (remaining.length > 0) {
      remaining[0].active = true;
    }
  }

  save(wallets);
}
