const ADMIN_WALLETS = [
  "0xabc...",
  "0xdef...",
];

export function resolveRole(wallet?: string) {
  if (!wallet) return "user";
  if (ADMIN_WALLETS.includes(wallet)) return "admin";
  return "author";
}
