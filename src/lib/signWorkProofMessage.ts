import { getWallets } from "@mysten/wallet-standard";
import type { SuiSignPersonalMessageFeature } from "@mysten/wallet-standard";

export async function signWorkProofMessage(message: string): Promise<{
  signature: string;
  walletAddress: string;
}> {
  const wallets = getWallets().get();

  if (!wallets.length) {
    throw new Error("Chưa cài ví SUI (Suiet / Sui Wallet / Martian)");
  }

  const wallet = wallets[0];
  if (!wallet.accounts || !wallet.accounts.length) {
    throw new Error("Ví SUI đang bị khoá. Hãy mở ví trước.");
  }

  const account = wallet.accounts[0];

  const feature =
    wallet.features["sui:signPersonalMessage"] as
      | SuiSignPersonalMessageFeature
      | undefined;

  if (!feature) {
    throw new Error("Ví không hỗ trợ signPersonalMessage");
  }

  const signer =
    (feature as any).signPersonalMessage ||
    (feature as any)["sui:signPersonalMessage"]?.signPersonalMessage;
  if (!signer) {
    throw new Error("Ví không hỗ trợ signPersonalMessage");
  }

  const result = await signer({
    message: new TextEncoder().encode(message),
    account,
  });

  return { signature: result.signature, walletAddress: account.address };
}
