import { ethers } from "ethers";
import ABI from "@/abi/CopyrightRegistry.json";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL!;
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;

export function getProvider() {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    return new ethers.BrowserProvider((window as any).ethereum);
  }
  return new ethers.JsonRpcProvider(RPC_URL);
}

export async function getContract() {
  const provider = getProvider();
  return new ethers.Contract(
    CONTRACT_ADDRESS,
    ABI,
    provider
  );
}
