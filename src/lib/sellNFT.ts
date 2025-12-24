"use client";

import { TransactionBlock } from "@mysten/sui.js/transactions";
import { SuiClient } from "@mysten/sui.js/client";
import type { WalletAccount } from "@mysten/wallet-standard";

/* ================= CONFIG ================= */

export const PACKAGE_ID = "0xe03787fe55f0879110d5431e36360ce893e09caaa1a205a5ced107c2a4fa5cc7";
export const MODULE = "chainstorm_nft";
export const FUNCTION = "sell_nft";

/* ================= SELL NFT ================= */

export async function sellNFT(params: {
  nftObjectId: string;
  price: bigint;
  buyerAddress: string;
  wallet: WalletAccount;
  signAndExecute: any;
  suiClient: SuiClient;
}) {
  const {
    nftObjectId,
    price,
    buyerAddress,
    wallet,
    signAndExecute,
    suiClient,
  } = params;

  const tx = new TransactionBlock();

  // dùng coin SUI trong ví
  const [payment] = tx.splitCoins(
    tx.gas,
    [tx.pure(price)]
  );

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::${FUNCTION}`,
    arguments: [
      tx.object(nftObjectId),
      payment,
      tx.pure(price),
      tx.pure(buyerAddress),
    ],
  });

  const result = await signAndExecute({
    transactionBlock: tx,
    options: {
      showEffects: true,
      showObjectChanges: true,
    },
  });

  return result;
}
