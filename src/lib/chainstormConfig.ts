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
    registryId: "0x6247d94b63175966b378c9f7b901ec54c9d74a92c61c42150dc57c6d18a95f01",
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
  const base = CHAINSTORM_BY_NETWORK[net];
  const envPackage = (process.env.NEXT_PUBLIC_CHAINSTORM_PACKAGE_ID || "").trim();
  const envRegistry = (process.env.NEXT_PUBLIC_CHAINSTORM_REGISTRY_ID || "").trim();
  const envModule = (process.env.NEXT_PUBLIC_CHAINSTORM_MODULE || "").trim();
  const envMintFn = (process.env.NEXT_PUBLIC_CHAINSTORM_MINT_FN || "").trim();

  return {
    packageId: envPackage || base.packageId,
    registryId: envRegistry || base.registryId,
    module: envModule || base.module,
    mintFn: envMintFn || base.mintFn,
  };
}
