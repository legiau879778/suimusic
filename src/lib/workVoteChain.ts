"use client";

import type { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";

export const WORK_VOTE = {
  PACKAGE_ID: process.env.NEXT_PUBLIC_WORK_VOTE_PACKAGE_ID || "",
  MODULE: process.env.NEXT_PUBLIC_WORK_VOTE_MODULE || "work_vote",
  BOARD_ID: process.env.NEXT_PUBLIC_WORK_VOTE_BOARD_ID || "",
  VOTE_FN: process.env.NEXT_PUBLIC_WORK_VOTE_FN || "vote_work",
  // type name key/value trong Move
  KEY_TYPE_SUFFIX: "::work_vote::WorkKey",
};

export function canUseWorkVote() {
  return !!WORK_VOTE.PACKAGE_ID && !!WORK_VOTE.BOARD_ID;
}

export function buildVoteWorkTx(workId: string) {
  if (!canUseWorkVote()) throw new Error("Work vote config missing");
  const wid = String(workId || "").trim();
  if (!wid) throw new Error("Missing workId");

  const tx = new Transaction();
  tx.moveCall({
    target: `${WORK_VOTE.PACKAGE_ID}::${WORK_VOTE.MODULE}::${WORK_VOTE.VOTE_FN}`,
    arguments: [tx.object(WORK_VOTE.BOARD_ID), tx.pure.string(wid)],
  });
  return tx;
}

/**
 * Read vote count for ONE workId via dynamic field object.
 * Return 0 if not exists.
 */
export async function getVoteCountForWork(params: {
  suiClient: SuiClient;
  workId: string;
}): Promise<number> {
  const { suiClient, workId } = params;
  if (!canUseWorkVote()) return 0;
  const wid = String(workId || "").trim();
  if (!wid) return 0;

  try {
    const keyType = `${WORK_VOTE.PACKAGE_ID}${WORK_VOTE.KEY_TYPE_SUFFIX}`;
    const resp = await suiClient.getDynamicFieldObject({
      parentId: WORK_VOTE.BOARD_ID,
      name: {
        type: keyType,
        value: { id: wid },
      },
    });

    // resp.data.content.fields.value.value
    const content: any = (resp as any)?.data?.content;
    const fields = content?.fields;
    const valueObj = fields?.value; // VoteCount
    const value = valueObj?.fields?.value;

    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}
