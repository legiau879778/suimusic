import { NextResponse } from "next/server";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { getChainstormConfig, normalizeSuiNet } from "@/lib/chainstormConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS = 400;
const PAGE_SIZE = 50;

function decodeHexToUtf8(hex: string) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!clean || clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean)) return "";
  const bytes = new Uint8Array(clean.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  return new TextDecoder().decode(bytes);
}

function decodeBytes(v: any): string {
  if (!v) return "";
  if (typeof v === "string") {
    if (v.startsWith("0x")) {
      const decoded = decodeHexToUtf8(v);
      return decoded || v;
    }
    return v;
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return "";
    if (typeof v[0] === "number") {
      return new TextDecoder().decode(Uint8Array.from(v));
    }
  }
  if (typeof v === "object") {
    if (Array.isArray(v.bytes)) return decodeBytes(v.bytes);
    if (typeof v.bytes === "string") return decodeBytes(v.bytes);
  }
  return "";
}

function sellTypeFromU8(v: any) {
  const n = Number(v);
  if (n === 1) return "exclusive";
  if (n === 2) return "license";
  if (n === 0) return "none";
  return String(v ?? "");
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const net = normalizeSuiNet(
      url.searchParams.get("network") || process.env.NEXT_PUBLIC_SUI_NETWORK || ""
    );
    const cfg = getChainstormConfig(net);
    if (!cfg?.packageId) {
      return NextResponse.json(
        { ok: false, error: "Missing chainstorm config" },
        { status: 400 }
      );
    }

    const client = new SuiClient({ url: getFullnodeUrl(net) });
    const type = `${cfg.packageId}::${cfg.module || "chainstorm_nft"}::WorkNFT`;

    let cursor: string | null = null;
    const items: any[] = [];

    while (items.length < MAX_ITEMS) {
      // eslint-disable-next-line no-await-in-loop
      const page = await client.queryObjects({
        query: { MoveStructType: type },
        cursor,
        limit: PAGE_SIZE,
        options: { showContent: true, showType: true },
      });

      for (const it of page.data || []) {
        const id = it.data?.objectId;
        const content: any = it.data?.content;
        if (!id || !content || content.dataType !== "moveObject") continue;
        const fields: any = content.fields || {};
        const walrusFileId = decodeBytes(fields.walrus_file_id);
        const walrusMetaId = decodeBytes(fields.walrus_meta_id);
        const proofId = decodeBytes(fields.proof_id);

        items.push({
          id,
          nftObjectId: id,
          nftPackageId: cfg.packageId,
          authorId: String(fields.author || ""),
          authorWallet: String(fields.author || ""),
          fileHash: String(fields.file_hash || ""),
          metaHash: String(fields.meta_hash || ""),
          walrusFileId: walrusFileId || undefined,
          walrusMetaId: walrusMetaId || undefined,
          walrusCoverId: undefined,
          proofId: proofId || undefined,
          sellType: sellTypeFromU8(fields.sell_type),
          royalty: Number(fields.royalty ?? 0),
          status: "verified",
          hash: walrusMetaId ? `walrus:${walrusMetaId}` : undefined,
          txDigest: String(it.data?.previousTransaction || ""),
        });
        if (items.length >= MAX_ITEMS) break;
      }

      if (!page.hasNextPage || !page.nextCursor) break;
      cursor = page.nextCursor;
    }

    return NextResponse.json({ ok: true, network: net, works: items });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to load on-chain works" },
      { status: 500 }
    );
  }
}
