"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";

import {
  autoCleanTrash,
  bindLicenseToWork,
  getActiveWorks,
  getTrashWorks,
  markWorkSold,
  restoreWork,
  softDeleteWork,
  updateNFTOwner,
  bindNFTToWork,
  updateWorkConfig,
} from "@/lib/workStore";
import type { Work } from "@/lib/workStore";

import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import styles from "./manage.module.css";

/* ===== SUI SDK (NEW) ===== */
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientContext,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";

/* ✅ network-aware config */
import { getChainstormConfig, normalizeSuiNet } from "@/lib/chainstormConfig";

type ViewMode = "active" | "trash";
type MarketFilter = "all" | "sell" | "license" | "none";

const PAGE_SIZE = 12;

/* ================= Utils ================= */

function shortAddr(a?: string) {
  if (!a) return "—";
  if (a.length <= 12) return a;
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function explorerObjUrl(net: "devnet" | "testnet" | "mainnet", objectId: string) {
  return `https://suiexplorer.com/object/${objectId}?network=${net}`;
}
function explorerTxUrl(net: "devnet" | "testnet" | "mainnet", digest: string) {
  return `https://suiexplorer.com/txblock/${digest}?network=${net}`;
}

/**
 * FIX: toGateway must accept common CIDv0 + CIDv1 (bafy/bafk/baf...).
 * Avoid cover/preview being "" => No cover
 */
function toGateway(input?: string) {
  if (!input) return "";

  let v = String(input).trim();

  if (v.startsWith("http://") || v.startsWith("https://")) return v;

  if (v.startsWith("/api/walrus/blob/")) return v;
  if (v.startsWith("walrus:")) {
    return `/api/walrus/blob/${v.slice("walrus:".length)}`;
  }
  if (v.startsWith("walrus://")) {
    return `/api/walrus/blob/${v.slice("walrus://".length)}`;
  }

  return "";
}

function normalizeIpfsUrl(url?: string) {
  return toGateway(url);
}
function cidToGateway(cidOrUrl?: string) {
  return toGateway(cidOrUrl);
}

/** ISO -> dd/mm/yyyy */
function toDDMMYYYY(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/** createdDate display for UI (prefer work.createdDate) */
function pickCreatedDate(work: Work, meta: any | null) {
  const w = String(work.createdDate || "").trim();
  if (w) return w;

  const m1 = String(meta?.properties?.createdDate || "").trim();
  if (m1) return m1;

  const mIso = String(meta?.properties?.createdAtISO || "").trim();
  if (mIso) return toDDMMYYYY(mIso);

  return "—";
}

/** SHA-256(CID) -> 0x..(32 bytes hex) */
async function cidToAddressHex(cid: string): Promise<string> {
  const enc = new TextEncoder();
  const raw = enc.encode(cid);
  const hash = await crypto.subtle.digest("SHA-256", raw);
  const bytes = new Uint8Array(hash);
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** FIX: read mime/name from multiple places (top-level + properties) */
function guessKindFromFile(meta: any): "image" | "audio" | "video" | "pdf" | "other" {
  const t: string =
    meta?.file?.mime ||
    meta?.file?.type ||
    meta?.properties?.file?.type ||
    meta?.properties?.cover?.type ||
    meta?.mimeType ||
    "";

  const name: string =
    meta?.file?.name ||
    meta?.properties?.file?.name ||
    meta?.properties?.cover?.name ||
    meta?.name ||
    "";

  const lowerT = (t || "").toLowerCase();
  const lowerName = (name || "").toLowerCase();

  if (lowerT.startsWith("image/")) return "image";
  if (lowerT.startsWith("audio/")) return "audio";
  if (lowerT.startsWith("video/")) return "video";
  if (lowerT.includes("pdf")) return "pdf";

  if (/\.(png|jpg|jpeg|webp|gif|bmp|svg)$/.test(lowerName)) return "image";
  if (/\.(mp3|wav|ogg|m4a|flac)$/.test(lowerName)) return "audio";
  if (/\.(mp4|webm|mov|mkv)$/.test(lowerName)) return "video";
  if (/\.(pdf)$/.test(lowerName)) return "pdf";

  return "other";
}

/* ============ Metadata cache (memory) ============ */

const META_CACHE = new Map<string, any>();
const META_ERR = new Set<string>();

async function fetchMetadata(metaCidOrUrl: string) {
  const url = cidToGateway(metaCidOrUrl);
  if (!url) return null;

  if (META_CACHE.has(url)) return META_CACHE.get(url);
  if (META_ERR.has(url)) return null;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("metadata fetch failed");
    const json = await res.json();
    META_CACHE.set(url, json);
    return json;
  } catch {
    META_ERR.add(url);
    return null;
  }
}

/* ================= Page ================= */

export default function ManagePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const suiCtx = useSuiClientContext();
  const { mutateAsync: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();

  const activeNet = normalizeSuiNet(suiCtx?.network);
  const cfg = getChainstormConfig(activeNet);

  const PACKAGE_ID = cfg?.packageId || "";
  const MODULE = cfg?.module || "chainstorm_nft";

  const [view, setView] = useState<ViewMode>("active");
  const [filter, setFilter] = useState<MarketFilter>("all");

  const [works, setWorks] = useState<Work[]>([]);
  const [page, setPage] = useState(1);

  /** FIX TS: always allow string (fallback "") */
  const prevStatus = useRef<Record<string, string>>({});

  const [syncingOwners, setSyncingOwners] = useState<Record<string, boolean>>({});
  const [syncingAll, setSyncingAll] = useState(false);

  // ✅ per-card busy state
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [licensingId, setLicensingId] = useState<string | null>(null);

  const [selected, setSelected] = useState<Work | null>(null);

  /* ================= Load list ================= */

  const userId = user?.id || "";
  const userRole = (user as any)?.role || "";

  const load = useCallback(() => {
    if (!userId) {
      setWorks([]);
      return;
    }

    const base = view === "trash" ? getTrashWorks() : getActiveWorks();
    let list = userRole === "admin" ? base : base.filter((w) => w.authorId === userId);

    if (filter !== "all") {
      list = list.filter(
        (w) =>
          (filter === "sell" && w.sellType === "exclusive") ||
          (filter === "license" && w.sellType === "license") ||
          (filter === "none" && w.sellType === "none")
      );
    }

    // toast status change
    list.forEach((w) => {
      const id = String(w.id);
      const cur = (w.status ?? "") as string;

      const prev = prevStatus.current[id];
      if (prev && prev !== cur) {
        showToast(
          `Work "${w.title}" ${cur === "verified" ? "was verified" : "was rejected"}`,
          cur === "verified" ? "success" : "warning"
        );
      }

      // FIX TS: always a string
      prevStatus.current[id] = cur;
    });

    setWorks(list as Work[]);
  }, [filter, showToast, userId, userRole, view]);

  useEffect(() => {
    autoCleanTrash();

    load();
    window.addEventListener("works_updated", load);
    return () => window.removeEventListener("works_updated", load);
  }, [load]);

  useEffect(() => setPage(1), [view, filter]);

  /* ================= Pagination ================= */

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(works.length / PAGE_SIZE)),
    [works.length]
  );

  const visible = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return works.slice(start, start + PAGE_SIZE);
  }, [works, page]);

  /* ================= Auto-sync chain -> store ================= */

  const syncOneWorkFromChain = useCallback(
    async (w: Work) => {
      if (!PACKAGE_ID?.startsWith("0x")) return;

      // Case 1: nftObjectId exists => sync owner
      if (w.nftObjectId) {
        const obj = await suiClient.getObject({
          id: w.nftObjectId,
          options: { showOwner: true },
        });
        const owner = (obj as any)?.data?.owner?.AddressOwner as string | undefined;
        if (owner && owner.toLowerCase() !== String(w.authorWallet || "").toLowerCase()) {
          updateNFTOwner({ workId: w.id, newOwner: owner });
        }
        return;
      }

      // Case 2: no nftObjectId => scan by content_hash
      const cid = String(w.hash || "").trim();
      if (!cid) return;

      const ownerToScan = currentAccount?.address || w.authorWallet;
      if (!ownerToScan) return;

      const contentHashAddr = await cidToAddressHex(cid);
      const type = `${PACKAGE_ID}::${MODULE}::WorkNFT`;

      let cursor: string | null | undefined = null;

      for (let i = 0; i < 6; i++) {
        const resp = await suiClient.getOwnedObjects({
          owner: ownerToScan,
          filter: { StructType: type },
          options: { showContent: true, showType: true },
          cursor: cursor ?? undefined,
          limit: 50,
        });

        for (const it of resp.data as any[]) {
          const objectId = it?.data?.objectId as string | undefined;
          const fields = it?.data?.content?.fields;
          const ch = fields?.content_hash as string | undefined;

          if (objectId && ch && ch.toLowerCase() === contentHashAddr.toLowerCase()) {
            bindNFTToWork({
              workId: w.id,
              nftObjectId: objectId,
              packageId: PACKAGE_ID,
              txDigest: w.txDigest || "",
              authorWallet: ownerToScan,
            });
            return;
          }
        }

        cursor = resp.nextCursor;
        if (!resp.hasNextPage) break;
      }
    },
    [MODULE, PACKAGE_ID, currentAccount?.address, suiClient]
  );

  async function handleSyncAll(reason?: string) {
    if (!currentAccount?.address) {
      showToast("Please connect a wallet to sync", "warning");
      return;
    }
    if (!PACKAGE_ID?.startsWith("0x")) {
      showToast(`Missing packageId for network ${activeNet}`, "error");
      return;
    }

    try {
      setSyncingAll(true);
      showToast(reason || "Auto-syncing NFTs from chain...", "info");

      const base = getActiveWorks();
      const list = userRole === "admin" ? base : base.filter((x) => x.authorId === userId);

      const candidates = list.filter((w) => !!w.hash || !!w.nftObjectId);

      const toProcess = candidates.slice(0, 8);
      for (const w of toProcess) {
        // eslint-disable-next-line no-await-in-loop
        await syncOneWorkFromChain(w);
      }

      showToast("Sync completed (NFTs will auto-bind / sync owner if available)", "success");
    } catch (e) {
      console.error(e);
      showToast("Sync failed", "error");
    } finally {
      setSyncingAll(false);
    }
  }

  useEffect(() => {
    if (!userId) return;
    if (!currentAccount?.address) return;
    if (!PACKAGE_ID?.startsWith("0x")) return;
    if (view !== "active") return;

    const t = setInterval(() => {
      if (syncingAll || isPending) return;

      void (async () => {
        try {
          const base = getActiveWorks();
          const list = userRole === "admin" ? base : base.filter((x) => x.authorId === userId);

          const candidates = list.filter((w) => !!w.hash || !!w.nftObjectId);
          const need = candidates.filter((w) => !w.nftObjectId || !w.authorWallet);

          for (const w of need.slice(0, 4)) {
            // eslint-disable-next-line no-await-in-loop
            await syncOneWorkFromChain(w);
          }
        } catch {
          // silent
        }
      })();
    }, 30_000);

    return () => clearInterval(t);
  }, [
    userId,
    userRole,
    currentAccount?.address,
    PACKAGE_ID,
    view,
    syncingAll,
    isPending,
    syncOneWorkFromChain,
  ]);

  /* ================= Actions ================= */

  async function handleSyncOwner(work: Work) {
    if (!work?.nftObjectId) return;
    try {
      setSyncingOwners((m) => ({ ...m, [work.id]: true }));

      const obj = await suiClient.getObject({
        id: work.nftObjectId,
        options: { showOwner: true },
      });

      const owner = (obj as any)?.data?.owner?.AddressOwner as string | undefined;
      if (!owner) {
        showToast("Unable to read owner from chain", "warning");
        return;
      }

      updateNFTOwner({ workId: work.id, newOwner: owner });
      showToast(`Owner synced: ${shortAddr(owner)}`, "success");
    } catch (e) {
      console.error(e);
      showToast("Owner sync failed", "error");
    } finally {
      setSyncingOwners((m) => ({ ...m, [work.id]: false }));
    }
  }

  async function handleSellNFT(work: Work) {
    if (!currentAccount) {
      showToast("Please connect a wallet", "warning");
      return;
    }
    if (!PACKAGE_ID?.startsWith("0x")) {
      showToast(`Missing packageId for network ${activeNet}`, "error");
      return;
    }
    if (!work.nftObjectId) {
      showToast("Work has not bound NFT yet (click Auto-sync NFT)", "warning");
      return;
    }

    const buyer = prompt("Enter buyer wallet (0x...):");
    if (!buyer) return;

    const priceStr = prompt("Enter price (SUI)", "1");
    if (!priceStr) return;

    const priceMist = BigInt(Math.floor(Number(priceStr) * 1_000_000_000));
    if (priceMist <= BigInt(0)) {
      showToast("Invalid price", "warning");
      return;
    }

    try {
      setSellingId(work.id);
      showToast("Processing NFT sale transaction...", "info");

      const tx = new Transaction();
      const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(priceMist)]);

      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::sell_nft`,
        arguments: [
          tx.object(work.nftObjectId),
          payment,
          tx.pure.u64(priceMist),
          tx.pure.address(buyer),
        ],
      });

      const result = await signAndExecuteTransaction({ transaction: tx });

      markWorkSold({
        workId: work.id,
        buyerWallet: buyer,
        txDigest: (result as any).digest,
        priceMist: priceMist.toString(),
      });

      showToast("NFT sale successful", "success");
    } catch (e) {
      console.error(e);
      showToast("Transaction failed", "error");
    } finally {
      setSellingId(null);
    }
  }

  async function handleIssueLicense(work: Work) {
    if (!currentAccount) {
      showToast("Please connect a wallet", "warning");
      return;
    }
    if (!PACKAGE_ID?.startsWith("0x")) {
      showToast(`Missing packageId for network ${activeNet}`, "error");
      return;
    }
    if (!work.nftObjectId) {
      showToast("Work has not bound WorkNFT (click Auto-sync NFT)", "warning");
      return;
    }

    const licensee = prompt("Enter license buyer wallet (0x...):");
    if (!licensee) return;

    const royalty = Number(prompt("Royalty % (0-100)", String(work.royalty ?? 10)));
    if (Number.isNaN(royalty) || royalty < 0 || royalty > 100) {
      showToast("Invalid royalty", "warning");
      return;
    }

    try {
      setLicensingId(work.id);
      showToast("Issuing license...", "info");

      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::issue_license`,
        arguments: [
          tx.object(work.nftObjectId),
          tx.pure.address(licensee),
          tx.pure.u8(Math.floor(royalty)),
        ],
      });

      const result = await signAndExecuteTransaction({ transaction: tx });

      bindLicenseToWork({
        workId: work.id,
        licensee,
        royalty,
        txDigest: (result as any).digest,
      });

      showToast("License issued successfully", "success");
    } catch (e) {
      console.error(e);
      showToast("License issuance failed", "error");
    } finally {
      setLicensingId(null);
    }
  }

  function handleSoftDelete(work: Work) {
    if (!userId) return;

    const ok = confirm(`Move "${work.title}" to trash?`);
    if (!ok) return;

    try {
      softDeleteWork({
        workId: work.id,
        actor: { id: userId, role: userRole as any },
        walletAddress: currentAccount?.address,
      });
      if (selected?.id === work.id) {
        setSelected(null);
      }
      showToast("Moved to trash", "success");
    } catch (e: any) {
      console.error(e);
      if (String(e?.message).includes("FORBIDDEN")) {
        showToast("You do not have permission to delete this work", "error");
      } else {
        showToast("Delete failed", "error");
      }
    }
  }

  function handleRestore(work: Work) {
    if (!userId) return;

    if (userRole !== "admin") {
      showToast("Only admins can restore", "warning");
      return;
    }

    const ok = confirm(`Restore "${work.title}"?`);
    if (!ok) return;

    try {
      restoreWork({ workId: work.id, actor: { id: userId, role: userRole as any } });
      showToast("Work restored", "success");
    } catch (e: any) {
      console.error(e);
      showToast("Restore failed", "error");
    }
  }

  /* ================= Render ================= */

  if (!userId) {
    return (
      <div className={styles.page}>
        <div className={styles.locked}>
          <h2>Not signed in</h2>
          <p>Please sign in to manage works.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ===== Header ===== */}
      <div className={styles.header}>
        <div className={styles.headLeft}>
          <h1 className={styles.headTitle}>Manage works</h1>
          <div className={styles.headSub}>
            Network: <b>{activeNet}</b> • pkg:{" "}
            <b className={styles.mono}>{PACKAGE_ID ? shortAddr(PACKAGE_ID) : "missing"}</b>
          </div>
        </div>

        <div className={styles.headRight}>
          <button className={styles.btnPrimary} onClick={() => router.push("/register-work")}>
            + Register work
          </button>

          <button
            className={styles.btnSecondary}
            onClick={() => handleSyncAll("Auto-syncing NFTs from chain...")}
            disabled={syncingAll || isPending}
            title="Scan WorkNFTs in wallet by content_hash = sha256(metadataCid)"
          >
            {syncingAll ? "Syncing..." : "Auto-sync NFT"}
          </button>

          <div className={styles.selectWrap}>
            <select
              className={styles.select}
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="sell">Exclusive</option>
              <option value="license">License</option>
              <option value="none">Not for sale</option>
            </select>

            <select
              className={styles.select}
              value={view}
              onChange={(e) => setView(e.target.value as any)}
            >
              <option value="active">Active</option>
              <option value="trash">Trash</option>
            </select>
          </div>
        </div>
      </div>

      {/* ===== Empty ===== */}
      {works.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🎵</div>
          <div className={styles.emptyTitle}>No works yet</div>
          <div className={styles.emptySub}>Register your first work to mint an NFT.</div>
        </div>
      ) : null}

      {/* ===== Grid ===== */}
      <div className={styles.grid}>
        {visible.map((w) => (
          <WorkCard
            key={w.id}
            work={w}
            net={activeNet}
            onOpen={() => setSelected(w)}
            onSell={() => handleSellNFT(w)}
            onIssueLicense={() => handleIssueLicense(w)}
            onSyncOwner={() => handleSyncOwner(w)}
            onDelete={() => handleSoftDelete(w)}
            onRestore={() => handleRestore(w)}
            view={view}
            disableGlobal={isPending || syncingAll}
            selling={sellingId === w.id}
            licensing={licensingId === w.id}
            syncingOwner={!!syncingOwners[w.id]}
          />
        ))}
      </div>

      {/* ===== Pagination ===== */}
      {works.length > 0 ? (
        <div className={styles.pager}>
          <button
            className={styles.pagerBtn}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>

          <div className={styles.pagerInfo}>
            Page <b>{page}</b>/<b>{totalPages}</b> •{" "}
            <span className={styles.muted}>{works.length} items</span>
          </div>

          <button
            className={styles.pagerBtn}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      ) : null}

      {/* ===== Modal detail ===== */}
      {selected ? (
        <WorkDetailModal
          work={selected}
          net={activeNet}
          onClose={() => setSelected(null)}
          onSell={() => handleSellNFT(selected)}
          onIssueLicense={() => handleIssueLicense(selected)}
          onSyncOwner={() => handleSyncOwner(selected)}
          onDelete={() => handleSoftDelete(selected)}
          onRestore={() => handleRestore(selected)}
          view={view}
          disableGlobal={isPending || syncingAll}
          selling={sellingId === selected.id}
          licensing={licensingId === selected.id}
          syncingOwner={!!syncingOwners[selected.id]}
        />
      ) : null}
    </div>
  );
}

/* ================= Components ================= */

function WorkCard(props: {
  work: Work;
  net: "devnet" | "testnet" | "mainnet";
  onOpen: () => void;
  onSell: () => void;
  onIssueLicense: () => void;
  onSyncOwner: () => void;
  onDelete: () => void;
  onRestore: () => void;
  view: ViewMode;
  disableGlobal: boolean;
  selling: boolean;
  licensing: boolean;
  syncingOwner: boolean;
}) {
  const {
    work,
    net,
    onOpen,
    onSell,
    onIssueLicense,
    onSyncOwner,
    onDelete,
    onRestore,
    view,
    disableGlobal,
    selling,
    licensing,
    syncingOwner,
  } = props;

  const { showToast } = useToast();
  const [meta, setMeta] = useState<any | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [sellTypeEdit, setSellTypeEdit] = useState<string>(work.sellType || "exclusive");
  const [royaltyEdit, setRoyaltyEdit] = useState<string>(String(work.royalty ?? 0));
  const [savingEdit, setSavingEdit] = useState(false);

  const metaUrl = useMemo(() => cidToGateway(work.hash), [work.hash]);

  useEffect(() => {
    let alive = true;
    if (!metaUrl) {
      setMeta(null);
      return;
    }
    setLoadingMeta(true);
    fetchMetadata(metaUrl)
      .then((m) => alive && setMeta(m))
      .finally(() => alive && setLoadingMeta(false));
    return () => {
      alive = false;
    };
  }, [metaUrl]);

  useEffect(() => {
    setSellTypeEdit(work.sellType || "exclusive");
    setRoyaltyEdit(String(work.royalty ?? 0));
  }, [work.id, work.sellType, work.royalty]);

  useEffect(() => {
    setSellTypeEdit(work.sellType || "exclusive");
    setRoyaltyEdit(String(work.royalty ?? 0));
  }, [work.id, work.sellType, work.royalty]);

  // ✅ cover fallback: properties.cover.url -> cover_image -> cover.url -> image
  const coverUrl = useMemo(() => {
    const cover =
      normalizeIpfsUrl(meta?.properties?.cover?.url) ||
      normalizeIpfsUrl(meta?.cover_image) ||
      normalizeIpfsUrl(meta?.cover?.url);

    const img = normalizeIpfsUrl(meta?.image);
    return cover || img || "";
  }, [meta]);

  const kind = useMemo(() => guessKindFromFile(meta), [meta]);
  const createdText = useMemo(() => pickCreatedDate(work, meta), [work, meta]);

  // ✅ FIX TS: s?: string
  function statusLabel(s?: string) {
    if (s === "verified") return "Verified";
    if (s === "pending") return "Pending";
    if (s === "rejected") return "Rejected";
    return "—";
  }
  function sellTypeLabel(t?: string) {
    if (t === "exclusive") return "Exclusive";
    if (t === "license") return "License";
    if (t === "none") return "Not for sale";
    return t || "—";
  }

  async function saveEdit() {
    if (view === "trash") return;
    const royaltyNum = Math.max(0, Math.min(100, Math.floor(Number(royaltyEdit || 0))));
    setSavingEdit(true);
    try {
      updateWorkConfig({
        workId: work.id,
        sellType: sellTypeEdit as any,
        royalty: royaltyNum,
      });
      showToast("Updated sellType/royalty.", "success");
    } catch (e: any) {
      showToast(e?.message || "Update failed", "error");
    } finally {
      setSavingEdit(false);
    }
  }


  return (
    <div
      className={styles.card}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
    >
      <div className={styles.cardHead}>
        <div className={styles.cardTitle} title={work.title}>
          {work.title}
        </div>

        <div className={styles.badges}>
          <span className={styles.badge} data-status={work.status ?? "unknown"}>
            {statusLabel(work.status)}
          </span>
          <span className={styles.badge2}>{sellTypeLabel(work.sellType)}</span>
        </div>
      </div>

      <div className={styles.preview}>
        {loadingMeta ? (
          <div className={styles.previewLoading}>Loading…</div>
        ) : coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.previewImg} src={coverUrl} alt={work.title} />
        ) : (
          <div className={styles.previewEmpty}>No cover</div>
        )}

        <div className={styles.previewHint}>
          {kind === "audio"
            ? "🎵 Audio"
            : kind === "video"
            ? "🎬 Video"
            : kind === "pdf"
            ? "📄 PDF"
            : "🧾"}
        </div>

        <div
          className={`${styles.dateBadge} ${createdText === "—" ? styles.dateBadgeMuted : ""}`}
          title="Creation date"
        >
          {createdText}
        </div>

        <div className={styles.previewOverlay}>
          <span className={styles.previewCta}>View details -&gt;</span>
        </div>
      </div>

      <div className={styles.info}>
        <div className={styles.kv}>
          <span className={styles.k}>NFT</span>
          <span className={styles.v}>
            {work.nftObjectId ? (
              <a
                className={styles.link}
                href={explorerObjUrl(net, work.nftObjectId)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {shortAddr(work.nftObjectId)}
              </a>
            ) : (
              <span className={styles.warnText}>— not bound</span>
            )}
          </span>
        </div>

        <div className={styles.kv}>
          <span className={styles.k}>Owner</span>
          <span className={styles.v}>
            {work.authorWallet ? shortAddr(work.authorWallet) : "—"}
          </span>
        </div>

        <div className={styles.kv}>
          <span className={styles.k}>Royalty</span>
          <span className={styles.v}>
            <b>{work.royalty ?? 0}%</b>
          </span>
        </div>
      </div>

      <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
        <button
          className={styles.actionPrimary}
          onClick={onSell}
          disabled={view === "trash" || selling || disableGlobal}
          title={view === "trash" ? "Restore before action" : "Sell NFT"}
        >
          {selling ? "Selling..." : "Sell"}
        </button>

        <button
          className={styles.actionPrimary}
          onClick={onIssueLicense}
          disabled={view === "trash" || licensing || disableGlobal}
          title={view === "trash" ? "Restore before action" : "Issue license"}
        >
          {licensing ? "Issuing..." : "License"}
        </button>

        <button
          className={styles.actionGhost}
          onClick={onSyncOwner}
          disabled={!work.nftObjectId || syncingOwner || disableGlobal}
          title={!work.nftObjectId ? "No NFT yet" : "Read owner from chain"}
        >
          {syncingOwner ? "Sync…" : "Sync"}
        </button>

        {view === "active" ? (
          <button className={styles.actionDanger} onClick={onDelete} disabled={disableGlobal}>
            Delete
          </button>
        ) : (
          <button className={styles.actionGhost} onClick={onRestore} disabled={disableGlobal}>
            Restore
          </button>
        )}
      </div>
    </div>
  );
}

function WorkDetailModal(props: {
  work: Work;
  net: "devnet" | "testnet" | "mainnet";
  onClose: () => void;
  onSell: () => void;
  onIssueLicense: () => void;
  onSyncOwner: () => void;
  onDelete: () => void;
  onRestore: () => void;
  view: ViewMode;
  disableGlobal: boolean;
  selling: boolean;
  licensing: boolean;
  syncingOwner: boolean;
}) {
  const {
    work,
    net,
    onClose,
    onSell,
    onIssueLicense,
    onSyncOwner,
    onDelete,
    onRestore,
    view,
    disableGlobal,
    selling,
    licensing,
    syncingOwner,
  } = props;

  const { showToast } = useToast();
  const [meta, setMeta] = useState<any | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [sellTypeEdit, setSellTypeEdit] = useState<string>(work.sellType || "exclusive");
  const [royaltyEdit, setRoyaltyEdit] = useState<string>(String(work.royalty ?? 0));
  const [savingEdit, setSavingEdit] = useState(false);

  const metaUrl = useMemo(() => cidToGateway(work.hash), [work.hash]);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!metaUrl) {
        setMeta(null);
        return;
      }
      setLoadingMeta(true);
      const m = await fetchMetadata(metaUrl);
      if (alive) setMeta(m);
      if (alive) setLoadingMeta(false);
    }
    run();
    return () => {
      alive = false;
    };
  }, [metaUrl]);

  useEffect(() => {
    setSellTypeEdit(work.sellType || "exclusive");
    setRoyaltyEdit(String(work.royalty ?? 0));
  }, [work.id, work.sellType, work.royalty]);

  const coverUrl = useMemo(() => {
    const cover =
      normalizeIpfsUrl(meta?.properties?.cover?.url) ||
      normalizeIpfsUrl(meta?.cover_image) ||
      normalizeIpfsUrl(meta?.cover?.url);

    const img = normalizeIpfsUrl(meta?.image);
    return cover || img || "";
  }, [meta]);

  const mediaUrl = useMemo(() => {
    const a = normalizeIpfsUrl(meta?.animation_url);
    const f =
      normalizeIpfsUrl(meta?.file?.url) ||
      normalizeIpfsUrl(meta?.properties?.file?.url);
    return a || f || "";
  }, [meta]);

  const kind = useMemo(() => guessKindFromFile(meta), [meta]);
  const createdText = useMemo(() => pickCreatedDate(work, meta), [work, meta]);

  function stop(e: MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
  }

  function statusLabel(s?: string) {
    if (s === "verified") return "Verified";
    if (s === "pending") return "Pending";
    if (s === "rejected") return "Rejected";
    return "—";
  }
  function sellTypeLabel(t?: string) {
    if (t === "exclusive") return "Exclusive";
    if (t === "license") return "License";
    if (t === "none") return "Not for sale";
    return t || "—";
  }

  async function saveEdit() {
    if (view === "trash") return;
    const royaltyNum = Math.max(0, Math.min(100, Math.floor(Number(royaltyEdit || 0))));
    setSavingEdit(true);
    try {
      updateWorkConfig({
        workId: work.id,
        sellType: sellTypeEdit as any,
        royalty: royaltyNum,
      });
      showToast("Updated sellType/royalty.", "success");
    } catch (e: any) {
      showToast(e?.message || "Update failed", "error");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div className={styles.modalPro} onClick={stop} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>{work.title}</div>
            <div className={styles.modalSub}>
              <span className={styles.badge} data-status={work.status ?? "unknown"}>
                {statusLabel(work.status)}
              </span>
              <span className={styles.badge2}>{sellTypeLabel(work.sellType)}</span>
              <span className={styles.modalDot}>•</span>
              <span className={styles.mono}>{net}</span>
            </div>
          </div>

          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.modalPreviewPro}>
          {loadingMeta ? (
            <div className={styles.previewLoading}>Loading…</div>
          ) : coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.modalImgPro} src={coverUrl} alt={work.title} />
          ) : (
            <div className={styles.previewEmpty}>No cover</div>
          )}

          <div className={styles.previewGrid} />
          <div className={styles.previewGloss} />

          <div className={`${styles.dateBadge} ${createdText === "—" ? styles.dateBadgeMuted : ""}`}>
            {createdText}
          </div>
        </div>

        <div className={styles.mediaBoxPro}>
          <div className={styles.mediaHead}>
            <div className={styles.mediaTitle}>Preview file</div>
            {mediaUrl ? (
              <a className={styles.link} href={mediaUrl} target="_blank" rel="noreferrer">
                Open
              </a>
            ) : null}
          </div>

          {!mediaUrl ? (
            <div className={styles.mediaEmpty}>
              No preview file (metadata missing animation_url / file.url).
            </div>
          ) : kind === "audio" ? (
            <audio className={styles.audio} controls src={mediaUrl} />
          ) : kind === "video" ? (
            <video className={styles.video} controls src={mediaUrl} />
          ) : kind === "pdf" ? (
            <iframe className={styles.pdf} src={mediaUrl} title="pdf-preview" />
          ) : kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.modalImg2} src={mediaUrl} alt="preview" />
          ) : (
            <div className={styles.mediaEmpty}>
              Unable to detect type.{" "}
              <a className={styles.link} href={mediaUrl} target="_blank" rel="noreferrer">
                Open file
              </a>
            </div>
          )}
        </div>

        <div className={styles.modalGridPro}>
          <KV label="Creation date" value={createdText} />
          <KV label="Owner" value={work.authorWallet ? shortAddr(work.authorWallet) : "—"} mono />
          <KV label="Royalty" value={`${work.royalty ?? 0}%`} />

          <KV
            label="NFT"
            value={
              work.nftObjectId ? (
                <a
                  className={styles.link}
                  href={explorerObjUrl(net, work.nftObjectId)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {work.nftObjectId}
                </a>
              ) : (
                "—"
              )
            }
            mono
          />

          <KV
            label="Tx"
            value={
              work.txDigest ? (
                <a
                  className={styles.link}
                  href={explorerTxUrl(net, work.txDigest)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {work.txDigest}
                </a>
              ) : (
                "—"
              )
            }
            mono
          />

          <KV
            label="Metadata"
            value={
              metaUrl ? (
                <a className={styles.link} href={metaUrl} target="_blank" rel="noreferrer">
                  {metaUrl}
                </a>
              ) : (
                "—"
              )
            }
            mono
          />

          <KV
            label="Author"
            value={`${work.authorName || work.authorId || "—"}${
              work.authorPhone ? ` • ${work.authorPhone}` : ""
            }`}
          />
        </div>

        {meta?.description ? <div className={styles.metaDesc}>{meta.description}</div> : null}

        <div className={styles.editBox}>
          <div className={styles.editTitle}>Update sales & royalty</div>
          <div className={styles.editRow}>
            <label className={styles.editLabel}>Type</label>
            <select
              className={styles.editSelect}
              value={sellTypeEdit}
              onChange={(e) => setSellTypeEdit(e.target.value)}
              disabled={view === "trash" || disableGlobal || savingEdit}
            >
              <option value="exclusive">Exclusive</option>
              <option value="license">License</option>
              <option value="none">Not for sale</option>
            </select>
          </div>

          <div className={styles.editRow}>
            <label className={styles.editLabel}>Royalty (%)</label>
            <input
              className={styles.editInput}
              value={royaltyEdit}
              onChange={(e) => setRoyaltyEdit(e.target.value)}
              inputMode="numeric"
              disabled={view === "trash" || disableGlobal || savingEdit}
            />
          </div>

          <div className={styles.editActions}>
            <button
              className={styles.btnPrimary}
              onClick={saveEdit}
              disabled={view === "trash" || disableGlobal || savingEdit}
            >
              {savingEdit ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>

        <div className={styles.licenseBox}>
          <div className={styles.licenseHead}>
            <div className={styles.licenseTitle}>License history</div>
            <div className={styles.licenseHint}>
              {work.sellType === "license" ? "Sold as license" : "Not in license mode"}
            </div>
          </div>

          {work.licenses && work.licenses.length > 0 ? (
            <div className={styles.licenseList}>
              {work.licenses
                .slice()
                .reverse()
                .map((l: any, idx: number) => (
                  <div key={idx} className={styles.licenseItem}>
                    <div className={styles.licenseRow}>
                      <span className={styles.mono}>{shortAddr(l.licensee)}</span>
                      <span className={styles.royaltyPill}>{l.royalty}%</span>
                    </div>
                    <div className={styles.licenseRow2}>
                      <span className={styles.mutedSmall}>
                        {new Date(l.issuedAt).toLocaleString()}
                      </span>
                      <a
                        className={styles.linkSmall}
                        href={explorerTxUrl(net, l.txDigest)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        tx
                      </a>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className={styles.licenseEmpty}>No licenses yet.</div>
          )}
        </div>

        <div className={styles.modalActions}>
          <button
            className={styles.actionPrimary}
            onClick={onSell}
            disabled={view === "trash" || selling || disableGlobal}
          >
            {selling ? "Selling..." : "Sell NFT"}
          </button>

          <button
            className={styles.actionPrimary}
            onClick={onIssueLicense}
            disabled={view === "trash" || licensing || disableGlobal}
          >
            {licensing ? "Issuing..." : "Issue license"}
          </button>

          <button
            className={styles.actionGhost}
            onClick={onSyncOwner}
            disabled={!work.nftObjectId || syncingOwner || disableGlobal}
          >
            {syncingOwner ? "Sync…" : "Sync Owner"}
          </button>

          {view === "active" ? (
            <button className={styles.actionDanger} onClick={onDelete} disabled={disableGlobal}>
              Delete
            </button>
          ) : (
            <button className={styles.actionGhost} onClick={onRestore} disabled={disableGlobal}>
              Restore
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function KV(props: { label: string; value: any; mono?: boolean }) {
  return (
    <div className={styles.kv2}>
      <div className={styles.k2}>{props.label}</div>
      <div className={props.mono ? styles.v2Mono : styles.v2}>{props.value}</div>
    </div>
  );
}
