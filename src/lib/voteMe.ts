"use client";

import { Transaction } from "@mysten/sui/transactions";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";

/**
 * ✅ Bạn PHẢI cấu hình theo package/dashboard sau khi publish contract.
 * (y hệt kiểu repo Jerga99/sui-voting-app: constants.ts cần PACKAGE_ID + DASHBOARD_ID) :contentReference[oaicite:2]{index=2}
 */
export const VOTING = {
  PACKAGE_ID: process.env.NEXT_PUBLIC_VOTING_PACKAGE_ID || "",
  MODULE: process.env.NEXT_PUBLIC_VOTING_MODULE || "voting_system",
  DASHBOARD_ID: process.env.NEXT_PUBLIC_VOTING_DASHBOARD_ID || "",
  /** function vote trong Move (ví dụ: "vote" hoặc "vote_for_candidate") */
  VOTE_FN: process.env.NEXT_PUBLIC_VOTING_VOTE_FN || "vote",
};

/**
 * Rule: Vote me cần authorWallet (để vote target rõ ràng).
 * Nếu bạn vote theo authorId thì vẫn cho phép, nhưng on-chain thường dùng address.
 */
export function canVoteMe(authorWallet?: string) {
  return !!String(authorWallet || "").trim() && !!VOTING.PACKAGE_ID && !!VOTING.DASHBOARD_ID;
}

/**
 * ✅ Gọi trong UI:
 * await voteMeForAuthor({ authorWallet, authorId })
 *
 * NOTE:
 * - Mình để args theo pattern phổ biến:
 *    vote(dashboard: &mut Dashboard, candidate: address)
 * - Nếu Move function của bạn khác signature => đổi tx.moveCall arguments cho khớp.
 */
export async function voteMeForAuthor(params: {
  authorWallet: string;
  authorId?: string; // fallback (optional)
}) {
  const pkg = VOTING.PACKAGE_ID.trim();
  const dash = VOTING.DASHBOARD_ID.trim();
  const mod = VOTING.MODULE.trim();
  const fn = VOTING.VOTE_FN.trim();

  const target = String(params.authorWallet || "").trim();
  if (!pkg || !dash) throw new Error("Voting config missing: PACKAGE_ID / DASHBOARD_ID");
  if (!target) throw new Error("Missing authorWallet");

  // IMPORTANT:
  // File này là helper thuần. Để sign/execute, bạn cần gọi trong component hook.
  // => Mình expose builder để page gọi được.
  throw new Error(
    "voteMeForAuthor() is a helper stub. Use buildVoteTx() + signAndExecute in a component."
  );
}

/**
 * ✅ Builder: tạo Transaction để component dùng hook signAndExecuteTransaction().
 * Bạn sẽ gọi:
 * const tx = buildVoteTx({ authorWallet });
 * await signAndExecute({ transaction: tx })
 */
export function buildVoteTx(params: { authorWallet: string }) {
  const pkg = VOTING.PACKAGE_ID.trim();
  const dash = VOTING.DASHBOARD_ID.trim();
  const mod = VOTING.MODULE.trim();
  const fn = VOTING.VOTE_FN.trim();

  const target = String(params.authorWallet || "").trim();
  if (!pkg || !dash) throw new Error("Voting config missing: PACKAGE_ID / DASHBOARD_ID");
  if (!target) throw new Error("Missing authorWallet");

  const tx = new Transaction();

  tx.moveCall({
    target: `${pkg}::${mod}::${fn}`,
    arguments: [
      tx.object(dash),
      tx.pure.address(target),
    ],
  });

  return tx;
}

/**
 * ✅ Hook wrapper tiện dùng trong Next.js component
 */
export function useVoteMe() {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  return {
    canVoteMe,
    async vote(authorWallet: string) {
      const tx = buildVoteTx({ authorWallet });
      return signAndExecute({ transaction: tx });
    },
  };
}
