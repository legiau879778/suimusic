import type { SuiClient } from "@mysten/sui/client";
import { getWorkById, getActiveWorks, patchWork, bindNFTToWork } from "@/lib/workStore";
import type { Work } from "@/lib/workStore";

type Net = "devnet" | "testnet" | "mainnet";

function isHexAddr32(s: string) {
  return /^0x[0-9a-fA-F]+$/.test(s);
}

/** SHA-256(metadataCid) -> hex string as 0x... (32 bytes) */
export async function cidToAddressHex(cid: string): Promise<string> {
  const enc = new TextEncoder();
  const raw = enc.encode(cid);
  const hash = await crypto.subtle.digest("SHA-256", raw);
  const bytes = new Uint8Array(hash); // 32 bytes
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export async function fetchOwnerByObjectId(suiClient: SuiClient, objectId: string): Promise<string | null> {
  const obj = await suiClient.getObject({
    id: objectId,
    options: { showOwner: true },
  });

  const owner = (obj as any)?.data?.owner;
  if (!owner) return null;
  if (owner.AddressOwner) return owner.AddressOwner as string;
  return null;
}

/**
 * ✅ Auto-sync 1 work:
 * - Nếu work chưa có nftObjectId:
 *   -> tìm WorkNFT trên chain theo content_hash == sha256(metadataCid) (address)
 * - Nếu có nftObjectId:
 *   -> sync owner wallet
 *
 * REQUIRE:
 * - Work.hash phải là metadata CID (bạn đang lưu đúng)
 * - Move WorkNFT có field content_hash: address (đúng theo Move của bạn)
 * - Struct name: `${packageId}::${module}::WorkNFT`
 */
export async function syncWorkNFTFromChain(params: {
  suiClient: SuiClient;
  workId: string;
  packageId: string;
  module: string;
  // wallet to compare / default authorWallet if missing
  defaultOwner?: string;
}) {
  const { suiClient, workId, packageId, module, defaultOwner } = params;

  const w = getWorkById(workId);
  if (!w) return { ok: false, reason: "WORK_NOT_FOUND" as const };

  // 1) if has nftObjectId => sync owner
  if (w.nftObjectId) {
    try {
      const owner = await fetchOwnerByObjectId(suiClient, w.nftObjectId);
      if (owner && owner.toLowerCase() !== (w.authorWallet || "").toLowerCase()) {
        patchWork(w.id, { authorWallet: owner });
      }
      return { ok: true, mode: "owner_sync" as const, owner: owner ?? null };
    } catch (e) {
      return { ok: false, reason: "OWNER_FETCH_FAILED" as const };
    }
  }

  // 2) no nftObjectId => need find by content_hash (sha256(metadataCid))
  const cid = w.hash?.trim();
  if (!cid) return { ok: false, reason: "NO_METADATA_CID" as const };

  // compute address hex
  const contentHashAddr = await cidToAddressHex(cid);

  // Search objects by type in owner account?
  // We don't know owner; better:
  // - Query all objects owned by defaultOwner if provided
  // - If not provided, try to infer from w.authorWallet or fail
  const ownerToScan = defaultOwner || w.authorWallet;
  if (!ownerToScan) return { ok: false, reason: "NO_OWNER_TO_SCAN" as const };

  // Fetch all WorkNFT objects owned by ownerToScan
  const type = `${packageId}::${module}::WorkNFT`;

  let cursor: string | null | undefined = null;
  const candidates: { objectId: string }[] = [];

  for (let i = 0; i < 20; i++) {
    const resp = await suiClient.getOwnedObjects({
      owner: ownerToScan,
      filter: { StructType: type },
      options: { showContent: true, showType: true },
      cursor: cursor ?? undefined,
      limit: 50,
    });

    for (const it of resp.data as any[]) {
      const objectId = it?.data?.objectId;
      const fields = it?.data?.content?.fields;

      // fields.content_hash should be address (0x...)
      const ch = fields?.content_hash;
      if (typeof objectId === "string" && typeof ch === "string") {
        if (ch.toLowerCase() === contentHashAddr.toLowerCase()) {
          candidates.push({ objectId });
        }
      }
    }

    cursor = resp.nextCursor;
    if (!resp.hasNextPage) break;
  }

  if (candidates.length === 0) {
    return { ok: false, reason: "NOT_FOUND_ON_CHAIN" as const, contentHashAddr };
  }

  // pick first match
  const nftObjectId = candidates[0].objectId;

  // bind off-chain
  bindNFTToWork({
    workId: w.id,
    nftObjectId,
    packageId,
    txDigest: w.txDigest || "", // unknown; keep empty
    authorWallet: ownerToScan,
  });

  return { ok: true, mode: "bind" as const, nftObjectId, contentHashAddr };
}

/** Sync all works of current author (or admin) */
export async function syncAllWorksNFTFromChain(params: {
  suiClient: SuiClient;
  packageId: string;
  module: string;
  ownerWallet: string; // current wallet connected
  onlyAuthorId?: string; // if you want filter by authorId
}) {
  const { suiClient, packageId, module, ownerWallet, onlyAuthorId } = params;

  const works = getActiveWorks().filter((w) => !onlyAuthorId || w.authorId === onlyAuthorId);

  const results: any[] = [];
  for (const w of works) {
    // only sync ones that are minted or have metadataCID hash
    if (!w.hash && !w.nftObjectId) continue;
    const r = await syncWorkNFTFromChain({
      suiClient,
      workId: w.id,
      packageId,
      module,
      defaultOwner: ownerWallet,
    });
    results.push({ workId: w.id, title: w.title, ...r });
  }
  return results;
}
