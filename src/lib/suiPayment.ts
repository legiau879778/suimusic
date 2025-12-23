import { TransactionBlock } from "@mysten/sui.js/transactions";

export async function payMembership({
  wallet,
  amountSui,
}: {
  wallet: any;
  amountSui: number;
}) {
  const tx = new TransactionBlock();

  const [coin] = tx.splitCoins(tx.gas, [
    tx.pure(amountSui * 1_000_000_000),
  ]);

  tx.transferObjects(
    [coin],
    tx.pure("0xYOUR_RECEIVER_WALLET_ADDRESS") // ví nhận tiền
  );

  const result = await wallet.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: {
      showEffects: true,
    },
  });

  return {
    txHash: result.digest,
    block: result.effects?.executedEpoch ?? 0,
  };
}
