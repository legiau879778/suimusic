import { NextResponse } from "next/server";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import {
  getChainstormConfig,
  normalizeSuiNet,
  type SuiNet,
} from "@/lib/chainstormConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS = 200;

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

async function fetchListings(
  client: SuiClient,
  net: SuiNet,
  cfg: { packageId: string; module?: string }
) {
  const type = `${cfg.packageId}::${cfg.module || "chainstorm_nft"}::Listing`;
  let cursor: string | null = null;
  const items: any[] = [];

  while (items.length < MAX_ITEMS) {
    // eslint-disable-next-line no-await-in-loop
    const page: any = await queryObjectsCompat(client as any, {
      query: { MoveStructType: type },
      cursor,
      limit: 50,
      options: { showContent: true, showType: true },
    });

    for (const it of page.data || []) {
      const fields = it?.data?.content?.fields || {};
      const workId = String(fields?.work_id || "");
      if (!workId) continue;
      items.push({
        id: it?.data?.objectId || it?.objectId,
        workId,
        seller: String(fields?.seller || ""),
        price: fields?.price ?? 0,
        network: net,
      });
    }

    if (items.length >= MAX_ITEMS) break;
    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return items;
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
    const items = await fetchListings(client, net, cfg);

    return NextResponse.json({ ok: true, data: items });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to fetch listings" },
      { status: 200 }
    );
  }
}
