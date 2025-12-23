export async function signWithSui(message: string) {
  const sui = (window as any).suiWallet || (window as any).sui;
  if (!sui) throw new Error("Chưa cài SUI Wallet");

  const accounts = await sui.requestAccounts();
  const address = accounts[0];

  const { signature } = await sui.signMessage({
    message,
    account: address,
  });

  return { address, signature };
}
