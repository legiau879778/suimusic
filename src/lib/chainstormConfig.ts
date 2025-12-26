// src/lib/chainstormConfig.ts
export type SuiNet = "devnet" | "testnet" | "mainnet";

export const CHAINSTORM_BY_NETWORK: Record<
  SuiNet,
  {
    packageId: string;
    registryId: string; // có thể rỗng nếu Move mint không cần registry object
    module: string;
    mintFn: string;
  }
> = {
  devnet: {
    packageId: "0xbfade441b8bd0baa42261eb7e4529b1a77a98533e5371acbe6a692cdc68752c7",
    registryId: "0xff6ce0d3ce9ae2523bb4f20e010f1365b139d4b60cd5ba878b8a43e69c082aa5",
    module: "chainstorm_nft", // 👈 đúng theo output publish
    mintFn: "mint", // 👈 giữ "mint" nếu function của bạn tên mint
  },
  testnet: {
    packageId: "0x672ff4692cb57ead0503db7b54028bbfca6aefee9f89eb2b5d025627172cab23",
    registryId: "0xe8a047033205e1d29ef22331303e6672ebf1b291a0e8da842448e4d6ef8de05a",
    module: "chainstorm_nft",
    mintFn: "mint",
  },
  mainnet: {
    packageId: "",
    registryId: "",
    module: "chainstorm_nft",
    mintFn: "mint",
  },
};

export function normalizeSuiNet(net?: string): SuiNet {
  const n = (net || "").toLowerCase();
  if (n.includes("main")) return "mainnet";
  if (n.includes("test")) return "testnet";
  return "devnet";
}
export function getChainstormConfig(net: SuiNet) {
  return CHAINSTORM_BY_NETWORK[net];
}
