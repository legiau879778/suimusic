// src/lib/suiWallet.ts

export async function connectSuiWallet(): Promise<string> {
  const wallet = (window as any).suiWallet;
  if (!wallet) throw new Error("Chưa cài ví SUI");

  const accounts = await wallet.requestAccounts();
  return accounts[0];
}

export async function signSuiMessage(message: string) {
  const wallet = (window as any).suiWallet;
  if (!wallet) throw new Error("Chưa cài ví SUI");

  const res = await wallet.signPersonalMessage({
    message: new TextEncoder().encode(message),
  });

  return res.signature;
}

export async function getSuiBalance(_address: string): Promise<number> {
  // 👉 hiện mock, sau gắn RPC thật
  return 25.0;
}
