import { NextResponse } from "next/server";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import {
  getChainstormConfig,
  normalizeSuiNet,
  type SuiNet,
} from "@/lib/chainstormConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function findListingByWorkId(
  client: SuiClient,
  net: SuiNet,
  cfg: { packageId: string; module?: string },
  workId: string
) {
  const type = `${cfg.packageId}::${cfg.module || "chainstorm_nft"}::Listing`;
  let cursor: string | null = null;
  const target = String(workId || "").toLowerCase();
  if (!target) return null;

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
      const wid = String(fields?.work_id || "").toLowerCase();
      return wid === target;
    });

    if (hit?.data?.objectId || hit?.objectId) {
      const fields = hit?.data?.content?.fields || {};
      return {
        id: hit?.data?.objectId || hit?.objectId,
        workId: String(fields?.work_id || ""),
        seller: String(fields?.seller || ""),
        price: fields?.price ?? 0,
        network: net,
      };
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
    const workId = String(url.searchParams.get("workId") || "").trim();

    const cfg = getChainstormConfig(net);
    if (!cfg?.packageId) {
      return NextResponse.json(
        { ok: false, error: "Missing chainstorm config" },
        { status: 400 }
      );
    }

    const client = new SuiClient({ url: getFullnodeUrl(net) });
    const hit = await findListingByWorkId(client, net, cfg, workId);

    return NextResponse.json({ ok: true, data: hit });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to find listing" },
      { status: 200 }
    );
  }
}
