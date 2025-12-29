import { SuiClient } from "@mysten/sui/client";

const TESTNET_RPC = process.env.NEXT_PUBLIC_SUI_RPC_TESTNET || "https://sui-testnet.publicnode.com";
const MAINNET_RPC = process.env.NEXT_PUBLIC_SUI_RPC_MAINNET || "https://sui-mainnet.publicnode.com";
const DEVNET_RPC = process.env.NEXT_PUBLIC_SUI_RPC_DEVNET || "https://sui-devnet.publicnode.com";

function resolveRpcUrl() {
  const net = String(process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet").toLowerCase();
  if (net.includes("main")) return MAINNET_RPC;
  if (net.includes("dev")) return DEVNET_RPC;
  return TESTNET_RPC;
}

export const suiClient = new SuiClient({
  url: resolveRpcUrl(),
});
