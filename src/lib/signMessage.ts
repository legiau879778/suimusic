import { ethers } from "ethers";

/**
 * Admin ký message khi duyệt
 */
export async function signApproveMessage(
  walletAddress: string,
  workId: string
) {
  if (!(window as any).ethereum) {
    throw new Error("No wallet");
  }

  const provider = new ethers.BrowserProvider(
    (window as any).ethereum
  );

  const signer = await provider.getSigner();

  const message = `
APPROVE WORK
Work ID: ${workId}
Admin Wallet: ${walletAddress}
Time: ${new Date().toISOString()}
`;

  const signature = await signer.signMessage(message);

  return {
    message,
    signature,
  };
}
