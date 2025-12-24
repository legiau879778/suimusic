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
    packageId: "0x840be8415e526c4d325b54e65b597f3907e9fd29251cb91a85dcd39d424de2a6",
    registryId: "0x4330abbe0a0194662515799e70cb30b1ba0e1a222ebc148e0c77ab61aff0e8d3", // 👈 tạm để rỗng (giải thích bên dưới)
    module: "chainstorm_nft", // 👈 đúng theo output publish
    mintFn: "mint", // 👈 giữ "mint" nếu function của bạn tên mint
  },
  testnet: {
    packageId: "",
    registryId: "",
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
