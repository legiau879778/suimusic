"use client";

import type { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";

export const WORK_VOTE = {
  PACKAGE_ID: process.env.NEXT_PUBLIC_WORK_VOTE_PACKAGE_ID || "",
  MODULE: process.env.NEXT_PUBLIC_WORK_VOTE_MODULE || "work_vote",
  BOARD_ID: process.env.NEXT_PUBLIC_WORK_VOTE_BOARD_ID || "",
  VOTE_FN: process.env.NEXT_PUBLIC_WORK_VOTE_FN || "vote_work",
  // dynamic field name type for vote key
  KEY_TYPE: "address",
};

export function canUseWorkVote() {
  return !!WORK_VOTE.PACKAGE_ID && !!WORK_VOTE.BOARD_ID;
}

function normalizeSuiAddress(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (raw.startsWith("0x")) {
    return /^0x[0-9a-fA-F]+$/.test(raw) ? raw.toLowerCase() : "";
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return `0x${raw.toLowerCase()}`;
  }
  return "";
}

export function resolveWorkVoteKey(work: {
  id?: string;
  workId?: string;
  nftObjectId?: string;
}): string {
  const candidates = [
    work.nftObjectId,
    (work as any).workId,
    work.id,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeSuiAddress(String(candidate || ""));
    if (normalized) return normalized;
  }
  return "";
}

export function buildVoteWorkTx(workKey: string) {
  if (!canUseWorkVote()) throw new Error("Work vote config missing");
  const wid = normalizeSuiAddress(workKey);
  if (!wid) throw new Error("Missing work vote key");

  const tx = new Transaction();
  tx.moveCall({
    target: `${WORK_VOTE.PACKAGE_ID}::${WORK_VOTE.MODULE}::${WORK_VOTE.VOTE_FN}`,
    arguments: [tx.object(WORK_VOTE.BOARD_ID), tx.pure.address(wid)],
  });
  return tx;
}

/**
 * Read vote count for ONE workId via dynamic field object.
 * Return 0 if not exists.
 */
export async function getVoteCountForWork(params: {
  suiClient: SuiClient;
  workKey: string;
}): Promise<number> {
  const { suiClient, workKey } = params;
  if (!canUseWorkVote()) return 0;
  const wid = normalizeSuiAddress(workKey);
  if (!wid) return 0;

  try {
    const keyType = WORK_VOTE.KEY_TYPE;
    const resp = await suiClient.getDynamicFieldObject({
      parentId: WORK_VOTE.BOARD_ID,
      name: {
        type: keyType,
        value: wid,
      },
    });

    // resp.data.content.fields.value.value
    const content: any = (resp as any)?.data?.content;
    const fields = content?.fields;
    const valueObj = fields?.value; // VoteCount | u64
    const rawValue =
      typeof valueObj === "number" || typeof valueObj === "string"
        ? valueObj
        : valueObj?.fields?.value ?? valueObj?.value;

    const n = Number(rawValue);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}
