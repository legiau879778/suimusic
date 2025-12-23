import { SuiClient } from "@mysten/sui/client";

/* =========================
   CLIENT
========================= */
export const suiClient = new SuiClient({
  url: "https://fullnode.mainnet.sui.io",
});

/* =========================
   TYPES
========================= */
export type SuiWalletStatus =
  | "not-installed"
  | "locked"
  | "ready";

type SuiProvider = {
  name: string;
  connect: () => Promise<{ accounts: string[] }>;
  signPersonalMessage: (input: {
    message: Uint8Array;
  }) => Promise<any>;
};

/* =========================
   GET PROVIDER (STANDARD)
========================= */
function getSuiProvider(): SuiProvider | null {
  if (typeof window === "undefined") return null;

  const w = window as any;

  // chuẩn mới
  if (w.sui?.wallet) return w.sui.wallet;

  // fallback cũ (Suiet very old)
  if (w.suiWallet) return w.suiWallet;

  return null;
}

/* =========================
   DETECT STATUS
========================= */
export async function detectSuietStatus(): Promise<SuiWalletStatus> {
  const provider = getSuiProvider();
  if (!provider) return "not-installed";

  try {
    // connect() KHÔNG mở popup nếu đã unlock
    await provider.connect();
    return "ready";
  } catch {
    return "locked";
  }
}

/* =========================
   CONNECT (USER ACTION)
========================= */
export async function connectSuiWallet(): Promise<string | null> {
  const provider = getSuiProvider();
  if (!provider) return null;

  try {
    const res = await provider.connect();
    return res.accounts?.[0] ?? null;
  } catch {
    return null;
  }
}

/* =========================
   SIGN
========================= */
export async function signSuiMessage(
  message: string
): Promise<boolean> {
  const provider = getSuiProvider();
  if (!provider) return false;

  try {
    await provider.signPersonalMessage({
      message: new TextEncoder().encode(message),
    });
    return true;
  } catch {
    return false;
  }
}

/* =========================
   BALANCE
========================= */
export async function getSuiBalance(
  address: string
): Promise<number> {
  const coins = await suiClient.getBalance({ owner: address });
  return Number(coins.totalBalance) / 1e9;
}
