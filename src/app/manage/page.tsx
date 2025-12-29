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
  syncWorksFromChain,
} from "@/lib/workStore";
import type { Work } from "@/lib/workStore";
import { addTrade } from "@/lib/tradeStore";

import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import styles from "./manage.module.css";
import {
  PROFILE_UPDATED_EVENT,
  findProfileByEmail,
  findProfileByWallet,
  loadProfile,
} from "@/lib/profileStore";
import { db } from "@/lib/firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

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
type MarketFilter = "all" | "sell" | "license";

const PAGE_SIZE = 12;

/* ================= Utils ================= */

function shortAddr(a?: string) {
  if (!a) return "—";
  if (a.length <= 12) return a;
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function normalizeAddress(input?: string) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  return raw.toLowerCase().startsWith("0x") ? raw : `0x${raw}`;
}

function isValidSuiAddress(input?: string) {
  const raw = normalizeAddress(input);
  return /^0x[0-9a-fA-F]{64}$/.test(raw);
}

function parseSuiAmount(input?: string) {
  const raw = String(input || "").trim().replace(",", ".");
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

function explorerObjUrl(net: "devnet" | "testnet" | "mainnet", objectId: string) {
  return `https://suiexplorer.com/object/${objectId}?network=${net}`;
}
function explorerTxUrl(net: "devnet" | "testnet" | "mainnet", digest: string) {
  return `https://suiexplorer.com/txblock/${digest}?network=${net}`;
}

/**
 * ✅ FIX: toGateway phải accept CIDv0 + CIDv1 phổ biến (bafy/bafk/baf...).
 * Tránh tình trạng cover/preview bị "" => No cover
 */
function toGateway(input?: string) {
  if (!input) return "";

  let v = String(input).trim();

  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.startsWith("/api/walrus/blob/")) return v;
  if (v.startsWith("walrus:")) return `/api/walrus/blob/${v.slice("walrus:".length)}`;
  if (v.startsWith("walrus://")) return `/api/walrus/blob/${v.slice("walrus://".length)}`;

  if (v.startsWith("ipfs://")) v = v.slice("ipfs://".length);

  v = v.replace(/^\/+/, "");
  if (v.startsWith("ipfs/")) v = v.slice("ipfs/".length);

  v = v.split("?")[0].split("#")[0];

  const isLikelyCid =
    v.startsWith("Qm") ||
    v.startsWith("bafy") ||
    v.startsWith("bafk") ||
    v.startsWith("baf");

  if (!isLikelyCid) return "";

  return `https://gateway.pinata.cloud/ipfs/${v}`;
}

function normalizeIpfsUrl(url?: string) {
  return toGateway(url);
}
function cidToGateway(cidOrUrl?: string) {
  return toGateway(cidOrUrl);
}

function normalizeWalrusId(v: string) {
  const raw = String(v || "").trim();
  if (!raw) return "";
  if (raw.startsWith("0x") && /^[0-9a-fA-F]{64}$/.test(raw.slice(2))) {
    return raw.slice(2);
  }
  return raw;
}

function normalizeHashToAddress(hex?: string) {
  const raw = String(hex || "").trim().toLowerCase();
  if (!raw) return "";
  const cleaned = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (cleaned.length !== 64) return "";
  return `0x${cleaned}`;
}

function resolveAuthorDisplayName(authorId?: string, fallback?: string) {
  const id = String(authorId || "").trim();
  if (!id) return String(fallback || "—");

  let p = loadProfile(id);
  if (!p || Object.keys(p).length === 0) {
    const byWallet = findProfileByWallet(id);
    if (byWallet?.profile) p = byWallet.profile;
  }
  if (!p || Object.keys(p).length === 0) {
    const byEmail = findProfileByEmail(id);
    if (byEmail?.profile) p = byEmail.profile;
  }

  const name = String((p as any)?.name || "").trim();
  return name || String(fallback || id);
}

function resolveMetaInput(work: Work) {
  const raw = String(
    work?.walrusMetaId ||
      (work as any)?.metadataCid ||
      (work as any)?.metadata ||
      work?.hash ||
      ""
  ).trim();
  if (!raw) return "";
  const clean = normalizeWalrusId(raw);
  if (
    clean.startsWith("http://") ||
    clean.startsWith("https://") ||
    clean.startsWith("walrus:") ||
    clean.startsWith("walrus://") ||
    clean.startsWith("/api/walrus/blob/")
  ) {
    return clean;
  }
  return `walrus:${clean}`;
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

/** createdDate display for UI (work.createdDate ưu tiên) */
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

/** ✅ FIX: đọc mime/name từ nhiều nơi (top-level + properties) */
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

  /** ✅ FIX TS: cho phép string luôn (fallback "") */
  const prevStatus = useRef<Record<string, string>>({});

  const [syncingOwners, setSyncingOwners] = useState<Record<string, boolean>>({});
  const [syncingAll, setSyncingAll] = useState(false);

  // ✅ per-card busy state
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [licensingId, setLicensingId] = useState<string | null>(null);

  const [selected, setSelected] = useState<Work | null>(null);
  const [listingMap, setListingMap] = useState<Record<string, any>>({});
  const [actionModal, setActionModal] = useState<{
    type: "sell" | "license";
    work: Work;
  } | null>(null);
  const [actionBuyer, setActionBuyer] = useState("");
  const [actionPrice, setActionPrice] = useState("1");
  const [actionRoyalty, setActionRoyalty] = useState("10");
  const [actionError, setActionError] = useState("");
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);
  const [gasLoading, setGasLoading] = useState(false);
  const [gasError, setGasError] = useState("");

  /* ================= Load list ================= */

  const userId = user?.id || "";
  const userEmail = String(user?.email || "").trim();
  const userRole = (user as any)?.role || "";
  const userWallets = useMemo(() => {
    const list = [
      user?.internalWallet?.address,
      user?.walletAddress,
      currentAccount?.address,
    ]
      .filter(Boolean)
      .map((w) => String(w).toLowerCase());
    return Array.from(new Set(list));
  }, [currentAccount?.address, user?.internalWallet?.address, user?.walletAddress]);

  const isWorkOwner = useCallback(
    (w: Work) => {
      if (userRole === "admin") return true;
      if (!userId && !userEmail) return false;
      if (userId && w.authorId === userId) return true;
      if (userEmail && w.authorId === userEmail) return true;
      return false;
    },
    [userId, userEmail, userRole]
  );

  const load = useCallback(() => {
    if (!userId && userWallets.length === 0 && userRole !== "admin") {
      setWorks([]);
      return;
    }

    const base = view === "trash" ? getTrashWorks() : getActiveWorks();
    let list = base.filter(isWorkOwner);

    if (filter !== "all") {
      list = list.filter(
        (w) =>
          (filter === "sell" && w.sellType === "exclusive") ||
          (filter === "license" && w.sellType === "license")
      );
    }

    // toast status change
    list.forEach((w) => {
      const id = String(w.id);
      const cur = (w.status ?? "") as string;

      const prev = prevStatus.current[id];
      if (prev && prev !== cur) {
        showToast(
          `Work "${w.title}" ${cur === "verified" ? "has been approved" : "has been rejected"}`,
          cur === "verified" ? "success" : "warning"
        );
      }

      // ✅ FIX TS: luôn là string
      prevStatus.current[id] = cur;
    });

    setWorks(list as Work[]);
  }, [filter, showToast, userId, userRole, userWallets.length, view, isWorkOwner]);

  useEffect(() => {
    autoCleanTrash();
    syncWorksFromChain({ force: true }).then(load).catch(() => load());
    window.addEventListener("works_updated", load);
    return () => window.removeEventListener("works_updated", load);
  }, [load]);

  useEffect(() => {
    let alive = true;
    async function loadListings() {
      try {
        const res = await fetch(`/api/chainstorm/listings?network=${activeNet}`);
        const data = await res.json();
        if (!alive) return;
        if (!data?.ok || !Array.isArray(data?.data)) {
          setListingMap({});
          return;
        }
        const next: Record<string, any> = {};
        for (const item of data.data) {
          const workId = String(item?.workId || "").toLowerCase();
          if (!workId) continue;
          next[workId] = item;
        }
        setListingMap(next);
      } catch {
        if (alive) setListingMap({});
      }
    }
    loadListings();
    return () => {
      alive = false;
    };
  }, [activeNet]);

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

      // Case 1: đã có nftObjectId => sync owner
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

      // Case 2: chưa có nftObjectId => scan theo file_hash / meta_hash
      const fileHashAddr = normalizeHashToAddress(w.fileHash);
      const metaHashAddr = normalizeHashToAddress(w.metaHash);
      if (!fileHashAddr && !metaHashAddr) return;

      const ownerToScan = currentAccount?.address || w.authorWallet;
      if (!ownerToScan) return;

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
          const fh = String(fields?.file_hash || "").toLowerCase();
          const mh = String(fields?.meta_hash || "").toLowerCase();
          const match =
            (fileHashAddr && fh === fileHashAddr.toLowerCase()) ||
            (metaHashAddr && mh === metaHashAddr.toLowerCase());

          if (objectId && match) {
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
      showToast("Please connect your wallet to sync", "warning");
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
      const list = base.filter(isWorkOwner);

      const candidates = list.filter((w) => !!w.hash || !!w.nftObjectId);

      const toProcess = candidates.slice(0, 8);
      for (const w of toProcess) {
        // eslint-disable-next-line no-await-in-loop
        await syncOneWorkFromChain(w);
      }

      showToast("✅ Sync xong (nếu có NFT sẽ tự bind / sync owner)", "success");
    } catch (e) {
      console.error(e);
      showToast("Sync thất bại", "error");
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
          const list = base.filter(isWorkOwner);

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
        showToast("Cannot read owner from chain", "warning");
        return;
      }

      updateNFTOwner({ workId: work.id, newOwner: owner });
      showToast(`Owner synced: ${shortAddr(owner)}`, "success");
    } catch (e) {
      console.error(e);
      showToast("Sync owner failed", "error");
    } finally {
      setSyncingOwners((m) => ({ ...m, [work.id]: false }));
    }
  }

  async function executeSellNFT(work: Work, buyer: string, priceNum: number) {
    if (!currentAccount) {
      showToast("Please connect your wallet", "warning");
      return;
    }
    if (!PACKAGE_ID?.startsWith("0x")) {
      showToast(`Missing packageId for network ${activeNet}`, "error");
      return;
    }
    if (!work.nftObjectId) {
      showToast("Work not bound to NFT (click Auto-sync NFT)", "warning");
      return;
    }

    const priceMist = BigInt(Math.floor(priceNum * 1_000_000_000));
    if (priceMist <= BigInt(0)) {
      showToast("Giá không hợp lệ", "warning");
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
      if (userId) {
        addTrade(userId, {
          id: crypto.randomUUID(),
          type: "sell",
          title: work.title || "Sell NFT",
          amountSui: priceNum || 0,
          txHash: (result as any).digest,
          status: "pending",
          createdAt: Date.now(),
          workId: work.id,
        });
      }

      showToast("🎉 Bán NFT thành công", "success");
    } catch (e) {
      console.error(e);
      showToast("Giao dịch thất bại", "error");
    } finally {
      setSellingId(null);
    }
  }

  async function executeIssueLicense(work: Work, licensee: string, royalty: number) {
    if (!currentAccount) {
      showToast("Vui lòng kết nối ví", "warning");
      return;
    }
    if (!PACKAGE_ID?.startsWith("0x")) {
      showToast(`Missing packageId for network ${activeNet}`, "error");
      return;
    }
    if (!work.nftObjectId) {
      showToast("Work not bound to WorkNFT (click Auto-sync NFT)", "warning");
      return;
    }

    if (Number.isNaN(royalty) || royalty < 0 || royalty > 100) {
      showToast("Royalty không hợp lệ", "warning");
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
      if (userId) {
        addTrade(userId, {
          id: crypto.randomUUID(),
          type: "license",
          title: work.title || "Issue License",
          amountSui: 0,
          txHash: (result as any).digest,
          status: "pending",
          createdAt: Date.now(),
          workId: work.id,
        });
      }

      showToast("✅ Cấp license thành công", "success");
    } catch (e) {
      console.error(e);
      showToast("Cấp license thất bại", "error");
    } finally {
      setLicensingId(null);
    }
  }

  function openSellModal(work: Work) {
    const lastBuyer = String(localStorage.getItem("chainstorm_last_buyer") || "");
    setActionModal({ type: "sell", work });
    setActionBuyer(lastBuyer);
    setActionPrice("1");
    setActionRoyalty(String(work.royalty ?? 10));
    setActionError("");
    setGasEstimate(null);
    setGasError("");
  }

  function openLicenseModal(work: Work) {
    const lastBuyer = String(localStorage.getItem("chainstorm_last_buyer") || "");
    setActionModal({ type: "license", work });
    setActionBuyer(lastBuyer);
    setActionPrice("1");
    setActionRoyalty(String(work.royalty ?? 10));
    setActionError("");
    setGasEstimate(null);
    setGasError("");
  }

  async function submitActionModal() {
    if (!actionModal) return;
    const { type, work } = actionModal;

    const buyer = normalizeAddress(actionBuyer);
    if (!isValidSuiAddress(buyer)) {
      setActionError("Ví người mua không hợp lệ");
      return;
    }

    if (type === "sell") {
      const priceNum = parseSuiAmount(actionPrice);
      if (!priceNum || priceNum <= 0) {
        setActionError("Giá không hợp lệ");
        return;
      }
      setActionError("");
      localStorage.setItem("chainstorm_last_buyer", buyer);
      await executeSellNFT(work, buyer, priceNum);
      setActionModal(null);
      return;
    }

    const royaltyNum = Number(actionRoyalty);
    if (Number.isNaN(royaltyNum) || royaltyNum < 0 || royaltyNum > 100) {
      setActionError("Royalty không hợp lệ");
      return;
    }
    setActionError("");
    localStorage.setItem("chainstorm_last_buyer", buyer);
    await executeIssueLicense(work, buyer, Math.floor(royaltyNum));
    setActionModal(null);
  }

  async function pasteBuyerFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        showToast("Clipboard trống", "warning");
        return;
      }
      setActionBuyer(text.trim());
    } catch {
      showToast("Không đọc được clipboard", "warning");
    }
  }

  async function estimateGas() {
    if (!actionModal) return;
    if (!currentAccount) {
      showToast("Vui lòng kết nối ví", "warning");
      return;
    }
    if (!PACKAGE_ID?.startsWith("0x")) {
      showToast(`Missing packageId for network ${activeNet}`, "error");
      return;
    }
    const { type, work } = actionModal;
    const buyer = normalizeAddress(actionBuyer);
    if (!isValidSuiAddress(buyer)) {
      setGasError("Ví người mua không hợp lệ");
      return;
    }
    setGasError("");
    setGasEstimate(null);
    setGasLoading(true);
    try {
      const tx = new Transaction();
      if (type === "sell") {
        const priceNum = parseSuiAmount(actionPrice);
        if (!priceNum || priceNum <= 0) {
          setGasError("Giá không hợp lệ");
          return;
        }
        const priceMist = BigInt(Math.floor(priceNum * 1_000_000_000));
        const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(priceMist)]);
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::sell_nft`,
          arguments: [
            tx.object(work.nftObjectId || ""),
            payment,
            tx.pure.u64(priceMist),
            tx.pure.address(buyer),
          ],
        });
      } else {
        const royaltyNum = Number(actionRoyalty);
        if (Number.isNaN(royaltyNum) || royaltyNum < 0 || royaltyNum > 100) {
          setGasError("Royalty không hợp lệ");
          return;
        }
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::issue_license`,
          arguments: [
            tx.object(work.nftObjectId || ""),
            tx.pure.address(buyer),
            tx.pure.u8(Math.floor(royaltyNum)),
          ],
        });
      }

      const bytes = await tx.build({ client: suiClient as any });
      const dry = await (suiClient as any).dryRunTransactionBlock({
        transactionBlock: bytes,
      });
      const gasUsed = dry?.effects?.gasUsed;
      if (gasUsed) {
        const total =
          Number(gasUsed.computationCost || 0) +
          Number(gasUsed.storageCost || 0) -
          Number(gasUsed.storageRebate || 0);
        const sui = total / 1e9;
        setGasEstimate(`${sui.toFixed(6)} SUI`);
      } else {
        setGasEstimate("—");
      }
    } catch (e) {
      console.error(e);
      setGasError("Không ước lượng được gas");
    } finally {
      setGasLoading(false);
    }
  }

  async function handleSoftDelete(work: Work) {
    if (!userId) return;

    const ok = confirm(`Đưa "${work.title}" vào thùng rác?`);
    if (!ok) return;

    try {
      softDeleteWork({
        workId: work.id,
        actor: { id: userId, role: userRole as any },
        walletAddress: currentAccount?.address,
      });
      if (work.nftObjectId) {
        await setDoc(
          doc(db, "works", work.nftObjectId),
          {
            authorId: work.authorId,
            workId: work.id,
            nftObjectId: work.nftObjectId,
            deletedAt: serverTimestamp(),
            deletedBy: userId,
          },
          { merge: true }
        );
      }
      showToast("🗑️ Moved to trash", "success");
    } catch (e: any) {
      console.error(e);
      if (String(e?.message).includes("FORBIDDEN")) {
        showToast("You do not have permission to delete this work", "error");
      } else {
        showToast("Delete failed", "error");
      }
    }
  }

  async function handleRestore(work: Work) {
    if (!userId) return;

    if (userRole !== "admin") {
      showToast("Chỉ admin mới được khôi phục", "warning");
      return;
    }

    const ok = confirm(`Khôi phục "${work.title}"?`);
    if (!ok) return;

    try {
      restoreWork({ workId: work.id, actor: { id: userId, role: userRole as any } });
      if (work.nftObjectId) {
        await setDoc(
          doc(db, "works", work.nftObjectId),
          {
            authorId: work.authorId,
            workId: work.id,
            nftObjectId: work.nftObjectId,
            deletedAt: null,
            restoredAt: serverTimestamp(),
            restoredBy: userId,
          },
          { merge: true }
        );
      }
      showToast("♻️ Work restored", "success");
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
          <h2>Not logged in</h2>
          <p>Please log in to manage your works.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ===== Header ===== */}
      <div className={styles.header}>
        <div className={styles.headLeft}>
          <h1 className={styles.headTitle}>Manage Works</h1>
          <div className={styles.headSub}>
            Network: <b>{activeNet}</b> • pkg:{" "}
            <b className={styles.mono}>{PACKAGE_ID ? shortAddr(PACKAGE_ID) : "missing"}</b>
          </div>
        </div>

        <div className={styles.headRight}>
          <button className={styles.btnPrimary} onClick={() => router.push("/register-work")}>
            + Register Work
          </button>

          <button
            className={styles.btnSecondary}
            onClick={() => handleSyncAll("Auto-syncing NFTs from chain...")}
            disabled={syncingAll || isPending}
            title="Scan WorkNFT in wallet by file_hash/meta_hash"
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
              <option value="sell">Sell outright</option>
              <option value="license">License</option>
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
          <div className={styles.emptySub}>Register your first work to mint NFT.</div>
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
              onSell={() => openSellModal(w)}
              onIssueLicense={() => openLicenseModal(w)}
              onSyncOwner={() => handleSyncOwner(w)}
              onDelete={() => handleSoftDelete(w)}
              onRestore={() => handleRestore(w)}
              view={view}
              disableGlobal={isPending || syncingAll}
              selling={sellingId === w.id}
              licensing={licensingId === w.id}
              syncingOwner={!!syncingOwners[w.id]}
              listing={listingMap[String(w.nftObjectId || "").toLowerCase()]}
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
            ← Trước
          </button>

          <div className={styles.pagerInfo}>
            Trang <b>{page}</b>/<b>{totalPages}</b> •{" "}
            <span className={styles.muted}>{works.length} items</span>
          </div>

          <button
            className={styles.pagerBtn}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Sau →
          </button>
        </div>
      ) : null}

      {/* ===== Modal detail ===== */}
      {selected ? (
        <WorkDetailModal
          work={selected}
          net={activeNet}
          onClose={() => setSelected(null)}
          onSell={() => openSellModal(selected)}
          onIssueLicense={() => openLicenseModal(selected)}
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

      {actionModal ? (
        <div className={styles.modalOverlay} role="presentation">
          <div className={`${styles.modalPro} ${styles.modalCompact}`} role="dialog" aria-modal="true">
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitle}>
                  {actionModal.type === "sell" ? "Sell NFT" : "Issue License"}
                </div>
                <div className={styles.modalSub}>
                  <span className={styles.badge2}>{actionModal.work.title}</span>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setActionModal(null)}>
                ✕
              </button>
            </div>

            <div className={styles.editBox}>
              <div className={styles.editRow}>
                <div className={styles.editLabel}>Buyer wallet (0x...)</div>
                <div className={styles.editInline}>
                  <input
                    className={styles.editInput}
                    value={actionBuyer}
                    onChange={(e) => setActionBuyer(e.target.value)}
                    placeholder="0x..."
                  />
                  <button
                    type="button"
                    className={styles.miniBtn}
                    onClick={pasteBuyerFromClipboard}
                  >
                    Paste
                  </button>
                </div>
              </div>

              {actionModal.type === "sell" ? (
                <div className={styles.editRow}>
                  <div className={styles.editLabel}>Price (SUI)</div>
                  <input
                    className={styles.editInput}
                    value={actionPrice}
                    onChange={(e) => setActionPrice(e.target.value)}
                    placeholder="1"
                  />
                </div>
              ) : null}

              {actionModal.type === "license" ? (
                <div className={styles.editRow}>
                  <div className={styles.editLabel}>Royalty % (0-100)</div>
                  <input
                    className={styles.editInput}
                    value={actionRoyalty}
                    onChange={(e) => setActionRoyalty(e.target.value)}
                    placeholder="10"
                  />
                </div>
              ) : null}

              {actionError ? <div className={styles.warnText}>{actionError}</div> : null}
              {gasError ? <div className={styles.warnText}>{gasError}</div> : null}
              {gasEstimate ? (
                <div className={styles.mutedSmall}>Estimated gas: {gasEstimate}</div>
              ) : null}

              <div className={styles.editActions}>
                <button
                  className={styles.actionGhost}
                  onClick={estimateGas}
                  disabled={gasLoading || isPending || sellingId != null || licensingId != null}
                >
                  {gasLoading ? "Estimating..." : "Estimate gas"}
                </button>
                <button
                  className={styles.actionGhost}
                  onClick={() => setActionModal(null)}
                  disabled={isPending || sellingId != null || licensingId != null}
                >
                  Cancel
                </button>
                <button
                  className={styles.actionPrimary}
                  onClick={submitActionModal}
                  disabled={isPending || sellingId != null || licensingId != null}
                >
                  {actionModal.type === "sell" ? "Confirm Sell" : "Confirm License"}
                </button>
              </div>
            </div>
          </div>
        </div>
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
  listing?: any;
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
    listing,
  } = props;

  const [meta, setMeta] = useState<any | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const metaInput = useMemo(() => resolveMetaInput(work), [work]);
  const metaUrl = useMemo(() => cidToGateway(metaInput), [metaInput]);

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

  // ✅ cover fallback: properties.cover.url -> cover_image -> cover.url -> image
  const coverUrl = useMemo(() => {
    const cover =
      normalizeIpfsUrl(meta?.properties?.cover?.url) ||
      normalizeIpfsUrl(meta?.cover_image) ||
      normalizeIpfsUrl(meta?.cover?.url) ||
      normalizeIpfsUrl(meta?.properties?.cover_image) ||
      normalizeIpfsUrl(meta?.properties?.image);

    const img = normalizeIpfsUrl(meta?.image);
    const fromWork =
      normalizeIpfsUrl(work?.metaImage) ||
      normalizeIpfsUrl((work as any)?.image) ||
      normalizeIpfsUrl((work as any)?.cover) ||
      "";
    const coverId = String(work?.walrusCoverId || "").trim();
    const fromCoverId = coverId ? normalizeIpfsUrl(`walrus:${coverId}`) : "";
    return cover || img || fromWork || fromCoverId || "";
  }, [meta, work]);

  const kind = useMemo(() => guessKindFromFile(meta), [meta]);
  const createdText = useMemo(() => pickCreatedDate(work, meta), [work, meta]);

  // ✅ FIX TS: s?: string
  function statusLabel(s?: string) {
    if (s === "verified") return "Approved";
    if (s === "pending") return "Pending";
    if (s === "rejected") return "Rejected";
    return "—";
  }
  function sellTypeLabel(t?: string) {
    if (t === "exclusive") return "Bán đứt";
    if (t === "license") return "License";
    return t || "—";
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
        {listing ? <span className={styles.badge2}>Listed</span> : null}
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
          title="Ngày sáng tác"
        >
          {createdText}
        </div>

        <div className={styles.previewOverlay}>
          <span className={styles.previewCta}>Xem chi tiết →</span>
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
              <span className={styles.warnText}>— chưa bind</span>
            )}
          </span>
        </div>

      <div className={styles.kv}>
        <span className={styles.k}>Owner</span>
        <span className={styles.v}>
          {work.authorWallet ? shortAddr(work.authorWallet) : "—"}
        </span>
      </div>

      {listing ? (
        <div className={styles.kv}>
          <span className={styles.k}>Listing</span>
          <span className={styles.v}>{Number(listing.price || 0) / 1e9} SUI</span>
        </div>
      ) : null}

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
          title={view === "trash" ? "Restore before operation" : "Sell NFT"}
        >
          {selling ? "Selling…" : "Sell"}
        </button>

        <button
          className={styles.actionPrimary}
          onClick={onIssueLicense}
          disabled={view === "trash" || licensing || disableGlobal}
          title={view === "trash" ? "Restore before operation" : "Issue license"}
        >
          {licensing ? "Issuing…" : "License"}
        </button>

        <button
          className={styles.actionGhost}
          onClick={onSyncOwner}
          disabled={!work.nftObjectId || syncingOwner || disableGlobal}
          title={!work.nftObjectId ? "Chưa có NFT" : "Đọc owner từ chain"}
        >
          {syncingOwner ? "Sync…" : "Sync"}
        </button>

        {view === "active" ? (
          <button className={styles.actionDanger} onClick={onDelete} disabled={disableGlobal}>
            Xoá
          </button>
        ) : (
          <button className={styles.actionGhost} onClick={onRestore} disabled={disableGlobal}>
            Khôi phục
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

  const [meta, setMeta] = useState<any | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [profileTick, setProfileTick] = useState(0);

  const metaInput = useMemo(() => resolveMetaInput(work), [work]);
  const metaUrl = useMemo(() => cidToGateway(metaInput), [metaInput]);

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
    const onProfile = () => setProfileTick((x) => x + 1);
    window.addEventListener(PROFILE_UPDATED_EVENT, onProfile as EventListener);
    return () =>
      window.removeEventListener(PROFILE_UPDATED_EVENT, onProfile as EventListener);
  }, []);

  const authorDisplayName = useMemo(
    () => resolveAuthorDisplayName(work.authorId, work.authorName),
    [work.authorId, work.authorName, profileTick]
  );

  const coverUrl = useMemo(() => {
    const cover =
      normalizeIpfsUrl(meta?.properties?.cover?.url) ||
      normalizeIpfsUrl(meta?.cover_image) ||
      normalizeIpfsUrl(meta?.cover?.url) ||
      normalizeIpfsUrl(meta?.properties?.cover_image) ||
      normalizeIpfsUrl(meta?.properties?.image);

    const img = normalizeIpfsUrl(meta?.image);
    const fromWork =
      normalizeIpfsUrl(work?.metaImage) ||
      normalizeIpfsUrl((work as any)?.image) ||
      normalizeIpfsUrl((work as any)?.cover) ||
      "";
    const coverId = String(work?.walrusCoverId || "").trim();
    const fromCoverId = coverId ? normalizeIpfsUrl(`walrus:${coverId}`) : "";
    return cover || img || fromWork || fromCoverId || "";
  }, [meta, work]);

  const mediaUrl = useMemo(() => {
    const a = normalizeIpfsUrl(meta?.animation_url);
    const f =
      normalizeIpfsUrl(meta?.file?.url) ||
      normalizeIpfsUrl(meta?.properties?.file?.url);
    const fileId = String(work?.walrusFileId || "").trim();
    const fromFileId = fileId ? normalizeIpfsUrl(`walrus:${fileId}`) : "";
    return a || f || fromFileId || "";
  }, [meta, work]);

  const kind = useMemo(() => guessKindFromFile(meta), [meta]);
  const createdText = useMemo(() => pickCreatedDate(work, meta), [work, meta]);

  function stop(e: MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
  }

  function statusLabel(s?: string) {
    if (s === "verified") return "Approved";
    if (s === "pending") return "Pending";
    if (s === "rejected") return "Rejected";
    return "—";
  }
  function sellTypeLabel(t?: string) {
    if (t === "exclusive") return "Bán đứt";
    if (t === "license") return "License";
    return t || "—";
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
              Không có file preview (metadata thiếu animation_url / file.url).
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
              Không nhận diện được type.{" "}
              <a className={styles.link} href={mediaUrl} target="_blank" rel="noreferrer">
                Mở file
              </a>
            </div>
          )}
        </div>

        <div className={styles.modalGridPro}>
          <KV label="Ngày sáng tác" value={createdText} />
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
            label="Tác giả"
            value={`${authorDisplayName}${
              work.authorPhone ? ` • ${work.authorPhone}` : ""
            }`}
          />
        </div>

        {meta?.description ? <div className={styles.metaDesc}>{meta.description}</div> : null}

        <div className={styles.licenseBox}>
          <div className={styles.licenseHead}>
            <div className={styles.licenseTitle}>License history</div>
            <div className={styles.licenseHint}>
              {work.sellType === "license" ? "Bán theo license" : "Không phải license mode"}
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
            <div className={styles.licenseEmpty}>Chưa có license nào.</div>
          )}
        </div>

        <div className={styles.modalActions}>
          <button
            className={styles.actionPrimary}
            onClick={onSell}
            disabled={view === "trash" || selling || disableGlobal}
          >
            {selling ? "Selling…" : "Sell NFT"}
          </button>

          <button
            className={styles.actionPrimary}
            onClick={onIssueLicense}
            disabled={view === "trash" || licensing || disableGlobal}
          >
            {licensing ? "Issuing…" : "Issue License"}
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
              Xoá
            </button>
          ) : (
            <button className={styles.actionGhost} onClick={onRestore} disabled={disableGlobal}>
              Khôi phục
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
