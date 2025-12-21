import { getContract } from "./contract";

export type ChainHistoryItem = {
  type: "REGISTER" | "TRADE";
  workId: string;
  amountEth: string;
  time: number;
  txHash: string;
};

export async function getHistoryByWallet(
  wallet: string
): Promise<ChainHistoryItem[]> {
  const contract = await getContract();

  const registerEvents = await contract.queryFilter(
    contract.filters.WorkRegistered(wallet)
  );

  const tradeEvents = await contract.queryFilter(
    contract.filters.WorkTraded(wallet)
  );

  const registerData: ChainHistoryItem[] =
    registerEvents.map((e: any) => ({
      type: "REGISTER",
      workId: e.args.workId,
      amountEth: (Number(e.args.fee) / 1e18).toString(),
      time: Number(e.args.time),
      txHash: e.transactionHash,
    }));

  const tradeData: ChainHistoryItem[] =
    tradeEvents.map((e: any) => ({
      type: "TRADE",
      workId: e.args.workId,
      amountEth: (Number(e.args.price) / 1e18).toString(),
      time: Number(e.args.time),
      txHash: e.transactionHash,
    }));

  return [...registerData, ...tradeData].sort(
    (a, b) => b.time - a.time
  );
}
