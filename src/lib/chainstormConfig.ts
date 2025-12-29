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
    packageId: "0x9f10ef3b767919df27e52e5665b99e081be7d208e89bfe8d9460416fd387e840",
    registryId: "0xb5bc05843c4a55c392291988c345ee7329d30abd4926204316f15b5d3405be74",
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
