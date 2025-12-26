import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { getChainstormConfig, normalizeSuiNet } from "@/lib/chainstormConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS = 400;
const PAGE_SIZE = 50;
const DEFAULT_CACHE_TTL_MS = 60_000;

function getCacheDir() {
  if (process.env.CHAINSTORM_CACHE_DIR) return process.env.CHAINSTORM_CACHE_DIR;
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (isServerless) {
    const tmp = process.env.TMPDIR || "/tmp";
    return path.join(tmp, "suimusic_cache");
  }
  return path.join(process.cwd(), "data");
}

function getCachePath(net: string) {
  return path.join(getCacheDir(), `chainstorm_works_${net}.json`);
}

function getCacheTtl() {
  const raw = Number(process.env.CHAINSTORM_CACHE_TTL_MS || "");
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return DEFAULT_CACHE_TTL_MS;
}

async function readCache(net: string) {
  try {
    const raw = await fs.readFile(getCachePath(net), "utf8");
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.works)) return null;
    return data as { cachedAt: number; works: any[] };
  } catch {
    return null;
  }
}

async function writeCache(net: string, works: any[]) {
  const dir = getCacheDir();
  await fs.mkdir(dir, { recursive: true });
  const payload = { cachedAt: Date.now(), works };
  await fs.writeFile(getCachePath(net), JSON.stringify(payload), "utf8");
  return payload.cachedAt;
}

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

async function fetchOnChainWorks(net: string, cfg: { packageId: string; module?: string }) {
  const client = new SuiClient({ url: getFullnodeUrl(net) });
  const type = `${cfg.packageId}::${cfg.module || "chainstorm_nft"}::WorkNFT`;

  let cursor: string | null = null;
  const items: any[] = [];

  while (items.length < MAX_ITEMS) {
    // eslint-disable-next-line no-await-in-loop
    const page: any = await (client as any).queryObjects({
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

  return items;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
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

    const ttl = getCacheTtl();
    const cached = await readCache(net);
    if (!force && cached && Date.now() - cached.cachedAt < ttl) {
      return NextResponse.json({
        ok: true,
        network: net,
        works: cached.works,
        cached: true,
        cachedAt: cached.cachedAt,
      });
    }

    const items = await fetchOnChainWorks(net, cfg);
    const cachedAt = await writeCache(net, items);

    return NextResponse.json({
      ok: true,
      network: net,
      works: items,
      cached: true,
      cachedAt,
    });
  } catch (e: any) {
    const url = new URL(req.url);
    const net = normalizeSuiNet(
      url.searchParams.get("network") || process.env.NEXT_PUBLIC_SUI_NETWORK || ""
    );
    const cached = await readCache(net);
    if (cached) {
      return NextResponse.json({
        ok: true,
        network: net,
        works: cached.works,
        cached: true,
        cachedAt: cached.cachedAt,
        stale: true,
        warning: e?.message || "Failed to refresh on-chain works",
      });
    }

    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to load on-chain works" },
      { status: 500 }
    );
  }
}
