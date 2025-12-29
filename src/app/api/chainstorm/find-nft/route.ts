import { NextResponse } from "next/server";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import {
  getChainstormConfig,
  normalizeSuiNet,
  type SuiNet,
} from "@/lib/chainstormConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeHex(input: string): string {
  const raw = String(input || "").trim().toLowerCase();
  const cleaned = raw.startsWith("0x") ? raw.slice(2) : raw;
  return cleaned.replace(/[^0-9a-f]/g, "");
}

function normalizeHashToAddress(hex: string): string {
  const cleaned = normalizeHex(hex);
  if (cleaned.length !== 64) return "";
  return `0x${cleaned}`;
}

async function queryObjectsCompat(
  client: any,
  params: {
    query?: { MoveStructType?: string; StructType?: string };
    cursor?: string | null;
    limit?: number;
    options?: { showContent?: boolean; showType?: boolean };
  }
) {
  if (typeof client.queryObjects === "function") {
    return client.queryObjects(params);
  }

  const structType =
    params.query?.StructType || params.query?.MoveStructType || "";
  if (typeof client.call === "function") {
    return client.call("suix_queryObjects", [
      {
        filter: structType ? { StructType: structType } : null,
        options: params.options || null,
      },
      params.cursor ?? null,
      params.limit ?? null,
    ]);
  }

  throw new Error("Sui client does not support queryObjects");
}

async function findWorkNFTByHash(
  client: SuiClient,
  net: SuiNet,
  cfg: { packageId: string; module?: string },
  fileHashHex: string,
  metaHashHex: string
) {
  const fileAddr = normalizeHashToAddress(fileHashHex);
  const metaAddr = normalizeHashToAddress(metaHashHex);
  if (!fileAddr && !metaAddr) return null;

  const type = `${cfg.packageId}::${cfg.module || "chainstorm_nft"}::WorkNFT`;
  let cursor: string | null = null;

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const page: any = await queryObjectsCompat(client as any, {
      query: { MoveStructType: type },
      cursor,
      limit: 50,
      options: { showContent: true, showType: true },
    });

    const hit = (page.data || []).find((obj: any) => {
      const fields = obj?.data?.content?.fields || {};
      const fh = String(fields?.file_hash || "").toLowerCase();
      const mh = String(fields?.meta_hash || "").toLowerCase();
      return (fileAddr && fh === fileAddr) || (metaAddr && mh === metaAddr);
    });

    if (hit?.data?.objectId || hit?.objectId) {
      const objectId = hit?.data?.objectId || hit?.objectId;
      const details = await client.getObject({
        id: objectId,
        options: { showOwner: true },
      });
      const owner = (details as any)?.data?.owner?.AddressOwner as string | undefined;
      return { objectId, owner, network: net };
    }

    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const net = normalizeSuiNet(
      url.searchParams.get("network") || process.env.NEXT_PUBLIC_SUI_NETWORK || ""
    );
    const fileHash = String(url.searchParams.get("fileHash") || "").trim();
    const metaHash = String(url.searchParams.get("metaHash") || "").trim();

    const cfg = getChainstormConfig(net);
    if (!cfg?.packageId) {
      return NextResponse.json(
        { ok: false, error: "Missing chainstorm config" },
        { status: 400 }
      );
    }

    const client = new SuiClient({ url: getFullnodeUrl(net) });
    const hit = await findWorkNFTByHash(
      client,
      net,
      cfg,
      fileHash,
      metaHash
    );

    return NextResponse.json({ ok: true, data: hit });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to find WorkNFT" },
      { status: 200 }
    );
  }
}
