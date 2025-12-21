// src/lib/wallet.ts
export async function connectWallet(): Promise<string> {
  if (!(window as any).ethereum) {
    throw new Error("Metamask not installed");
  }

  const accounts = await (window as any).ethereum.request({
    method: "eth_requestAccounts",
  });

  return accounts[0];
}
