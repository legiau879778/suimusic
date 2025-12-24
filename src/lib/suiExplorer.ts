export type SuiNetwork = "mainnet" | "testnet" | "devnet" | "localnet";

export function getSuiNetwork(): SuiNetwork {
  const n = (process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet").toLowerCase();
  if (n === "mainnet" || n === "testnet" || n === "devnet" || n === "localnet") return n;
  return "testnet";
}

export function explorerTxUrl(digest: string) {
  const net = getSuiNetwork();
  // Sui Explorer supports ?network=
  return `https://suiexplorer.com/txblock/${digest}?network=${net}`;
}

export function explorerObjectUrl(objectId: string) {
  const net = getSuiNetwork();
  return `https://suiexplorer.com/object/${objectId}?network=${net}`;
}

export function shortAddr(addr?: string | null) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}
