import { TransactionBlock } from "@mysten/sui.js/transactions";

export async function payMembership({
  signer,
  amountSui,
  receiver,
}: {
  signer: any;
  amountSui: number;
  receiver: string;
}) {
  const tx = new TransactionBlock();

  const [coin] = tx.splitCoins(
    tx.gas,
    [tx.pure(amountSui * 1e9)]
  );

  tx.transferObjects([coin], tx.pure(receiver));

  return signer.signAndExecuteTransactionBlock({
    transactionBlock: tx,
  });
}
