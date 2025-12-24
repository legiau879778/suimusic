import { TransactionBlock } from "@mysten/sui.js/transactions";

export async function payMembership({
  signer,
  suiClient,
  amountSui,
  receiver,
}: {
  signer: any;
  suiClient: any;
  amountSui: number;
  receiver: string;
}) {
  const tx = new TransactionBlock();

  const [coin] = tx.splitCoins(
    tx.gas,
    [tx.pure(amountSui * 1e9)]
  );

  tx.transferObjects([coin], tx.pure(receiver));

  const res = await signer.signAndExecuteTransactionBlock({
    transactionBlock: tx,
  });

  return res;
}
