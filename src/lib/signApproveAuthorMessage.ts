import { getWallets } from "@mysten/wallet-standard";
import type {
  SuiSignPersonalMessageFeature,
} from "@mysten/wallet-standard";

/**
 * 🔐 Admin ký message khi duyệt AUTHOR (SUI)
 * ✅ Chuẩn wallet-standard spec
 */
export async function signApproveAuthorMessage(
  authorId: string
): Promise<{
  message: string;
  signature: string;
  adminWallet: string;
}> {
  const wallets = getWallets().get();

  if (!wallets.length) {
    throw new Error(
      "Chưa cài ví SUI (Suiet / Sui Wallet / Martian)"
    );
  }

  const wallet = wallets[0];

  if (!wallet.accounts || !wallet.accounts.length) {
    throw new Error(
      "Ví SUI đang bị khoá. Hãy mở ví trước."
    );
  }

  const account = wallet.accounts[0];

  const message = `
APPROVE AUTHOR
Author ID: ${authorId}
Admin Wallet: ${account.address}
Time: ${new Date().toISOString()}
`.trim();

  /* ===============================
     🔑 FEATURE CAST ĐÚNG CHUẨN
  =============================== */

  const feature =
    wallet.features[
      "sui:signPersonalMessage"
    ] as SuiSignPersonalMessageFeature | undefined;

  if (!feature) {
    throw new Error(
      "Ví không hỗ trợ signPersonalMessage"
    );
  }

  // ❗ GỌI ĐÚNG 2 TẦNG KEY
  const result =
    await feature["sui:signPersonalMessage"]
      .signPersonalMessage({
        message: new TextEncoder().encode(message),
        account,
      });

  return {
    message,
    signature: result.signature,
    adminWallet: account.address,
  };
}
