import { getWallets } from "@mysten/wallet-standard";
import type {
  SuiSignPersonalMessageFeature,
} from "@mysten/wallet-standard";

/**
 * 🔐 Admin ký message khi duyệt WORK (SUI)
 * ⚠️ GIỮ TÊN signApproveMessage để không phá code cũ
 */
export async function signApproveMessage(
  walletAddress: string,
  workId: string
): Promise<{
  message: string;
  signature: string;
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
APPROVE WORK
Work ID: ${workId}
Admin Wallet: ${walletAddress}
Time: ${new Date().toISOString()}
`.trim();

  /* ===============================
     🔑 CAST FEATURE ĐÚNG CHUẨN
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
  };
}
