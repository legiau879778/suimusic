"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  bindLicenseToWork,
  bindNFTToWork,
  getWorkById,
  syncWorksFromChain,
  updateNFTOwner,
} from "@/lib/workStore";
import { useToast } from "@/context/ToastContext";
import { toGateway } from "@/lib/profileStore";
import { useAuth } from "@/context/AuthContext";
import { addTrade } from "@/lib/tradeStore";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

/* ===== SUI SDK (NEW) ===== */
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientContext,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";

/* ✅ CONFIG (network-aware) */
import { getChainstormConfig, normalizeSuiNet } from "@/lib/chainstormConfig";
import { fetchWalrusMetadata } from "@/lib/walrusMetaCache";

/* ================= HELPERS ================= */

function shortAddr(a?: string) {
  if (!a) return "—";
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function normalizeHex(input: string): string {
  const raw = String(input || "").trim().toLowerCase();
  const cleaned = raw.startsWith("0x") ? raw.slice(2) : raw;
  return cleaned.replace(/[^0-9a-f]/g, "");
}

function hexToBytes32(hex: string): Uint8Array {
  const cleaned = normalizeHex(hex);
  if (cleaned.length !== 64) {
    throw new Error("Hash must be 32 bytes (64 hex chars).");
  }
  const bytes = cleaned.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) || [];
  return new Uint8Array(bytes);
}

function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function normalizeHashToAddress(hex: string): string {
  const cleaned = normalizeHex(hex);
  if (cleaned.length !== 64) return "";
  return `0x${cleaned}`;
}

function getTypePackageId(type?: string) {
  if (!type) return "";
  return String(type).split("::")[0] || "";
}

function explorerTxUrl(net: "devnet" | "testnet" | "mainnet", digest: string) {
  return `https://suiexplorer.com/txblock/${digest}?network=${net}`;
}

function explorerObjUrl(net: "devnet" | "testnet" | "mainnet", objectId: string) {
  return `https://suiexplorer.com/object/${objectId}?network=${net}`;
}

function toSui(mist: any) {
  const n = Number(mist || 0);
  if (!Number.isFinite(n)) return "0.000";
  return (n / 1e9).toFixed(3);
}

async function fetchObjectOwnerAddress(suiClient: any, objectId: string): Promise<string | null> {
  const obj = await suiClient.getObject({
    id: objectId,
    options: { showOwner: true },
  });

  const owner = obj?.data?.owner;
  if (!owner) return null;
  if (owner.AddressOwner) return owner.AddressOwner as string;
  return null;
}

function resolveMetaInput(w: any) {
  const raw = String(w?.walrusMetaId || w?.metadataCid || w?.metadata || w?.hash || "").trim();
  if (!raw) return "";
  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("walrus:") ||
    raw.startsWith("walrus://") ||
    raw.startsWith("/api/walrus/blob/")
  ) {
    return raw;
  }
  return `walrus:${raw}`;
}

function resolveCover(meta: any, w: any) {
  const raw =
    meta?.image ||
    meta?.cover ||
    meta?.properties?.cover?.url ||
    meta?.properties?.cover_image ||
    meta?.properties?.image ||
    "";
  const byMeta = toGateway(raw);
  if (byMeta) return byMeta;
  const coverId = String(w?.walrusCoverId || "").trim();
  if (coverId) return toGateway(`walrus:${coverId}`);
  return "";
}

function resolveMedia(meta: any, w: any) {
  const raw =
    meta?.animation_url ||
    meta?.properties?.animation_url ||
    meta?.properties?.file?.url ||
    meta?.file?.url ||
    "";
  const byMeta = toGateway(raw);
  if (byMeta) return byMeta;
  const fileId = String(w?.walrusFileId || "").trim();
  if (fileId) return toGateway(`walrus:${fileId}`);
  return "";
}

function resolveAuthorEmail(meta: any, w: any) {
  const raw =
    meta?.properties?.author?.email ||
    meta?.author?.email ||
    meta?.properties?.email ||
    w?.authorEmail ||
    "";
  return String(raw || "").trim();
}

function guessMediaKind(meta: any, url: string): "audio" | "video" | "image" | "pdf" | "other" {
  const mime =
    String(meta?.file?.mime || meta?.file?.type || meta?.properties?.file?.type || "")
      .toLowerCase()
      .trim();
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";
  if (mime.includes("pdf")) return "pdf";

  const u = url.toLowerCase();
  if (/\.(mp3|wav|ogg|m4a|flac)$/.test(u)) return "audio";
  if (/\.(mp4|webm|mov|mkv)$/.test(u)) return "video";
  if (/\.(png|jpg|jpeg|webp|gif|bmp|svg)$/.test(u)) return "image";
  if (/\.(pdf)$/.test(u)) return "pdf";
  return "other";
}

function Waveform({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audio = await ctx.decodeAudioData(buf.slice(0));
        if (cancelled) return;

        const channel = audio.getChannelData(0);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const g = canvas.getContext("2d");
        if (!g) return;

        const width = canvas.width;
        const height = canvas.height;
        const step = Math.max(1, Math.floor(channel.length / width));

        g.clearRect(0, 0, width, height);
        g.fillStyle = "rgba(250,204,21,0.85)";

        for (let x = 0; x < width; x += 1) {
          let min = 1.0;
          let max = -1.0;
          const start = x * step;
          const end = Math.min(channel.length, start + step);
          for (let i = start; i < end; i += 1) {
            const v = channel[i];
            if (v < min) min = v;
            if (v > max) max = v;
          }
          const y = ((1 + min) / 2) * height;
          const h = Math.max(1, (max - min) * height);
          g.fillRect(x, height - y - h / 2, 1, h);
        }
      } catch {
        // ignore
      }
    }

    draw();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={88}
      style={{
        width: "100%",
        height: 88,
        background: "rgba(15,23,42,.65)",
        borderRadius: 10,
      }}
    />
  );
}

/* ================= COMPONENT ================= */

export default function MarketplaceDetailPage() {
  const params = useParams<{ id: string }>();
  const workId = params?.id;
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();

  const suiClient = useSuiClient();
  const suiCtx = useSuiClientContext();
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();

  // ✅ same network detection as register-work
  const activeNet = normalizeSuiNet(suiCtx?.network);
  const cfg = getChainstormConfig(activeNet);

  const PACKAGE_ID = cfg?.packageId || "";
  const REGISTRY_ID = cfg?.registryId || "";
  const MODULE = cfg?.module || "chainstorm_nft";
  const MINT_FN = cfg?.mintFn || "mint";
  const ISSUE_LICENSE_FN = "issue_license"; // Move fn name in your module

  const [work, setWork] = useState<any | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [buying, setBuying] = useState(false);
  const [meta, setMeta] = useState<any | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [listing, setListing] = useState<any | null>(null);
  const [listingLoading, setListingLoading] = useState(false);
  const [listingPrice, setListingPrice] = useState("1");
  const [listingBusy, setListingBusy] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResult, setLookupResult] = useState<{ objectId: string; owner?: string } | null>(
    null
  );

  // ✅ IMPORTANT: Hook must be called every render (not after early return)
  const licenses = useMemo(() => work?.licenses ?? [], [work?.licenses]);

  /* ================= LOAD WORK ================= */

  useEffect(() => {
    let alive = true;
    async function loadWork() {
      if (!workId) return;
      await syncWorksFromChain();
      if (!alive) return;
      const w = getWorkById(workId);
      if (!w) {
        router.replace("/marketplace");
        return;
      }
      setWork(w);
    }

    loadWork();
    const onUpdate = () => {
      const w = getWorkById(workId);
      if (w) setWork(w);
    };
    window.addEventListener("works_updated", onUpdate);
    return () => {
      alive = false;
      window.removeEventListener("works_updated", onUpdate);
    };
  }, [workId, router]);

  useEffect(() => {
    const nftId = String(work?.nftObjectId || workId || "").trim();
    if (!nftId) return;
    let alive = true;
    getDoc(doc(db, "works", nftId))
      .then((snap) => {
        if (!alive) return;
        const data: any = snap.data();
        if (data?.deletedAt) {
          showToast("Work đã bị gỡ khỏi marketplace.", "warning");
          router.replace("/marketplace");
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [work?.nftObjectId, workId, router, showToast]);

  useEffect(() => {
    let alive = true;
    async function loadMeta() {
      if (!work) return;
      const metaInput = resolveMetaInput(work);
      const metaUrl = toGateway(metaInput);
      if (!metaUrl) {
        setMeta(null);
        return;
      }
      setMetaLoading(true);
      try {
        const json = await fetchWalrusMetadata(metaInput);
        if (alive) setMeta(json);
      } catch {
        if (alive) setMeta(null);
      } finally {
        if (alive) setMetaLoading(false);
      }
    }
    loadMeta();
    return () => {
      alive = false;
    };
  }, [work]);

  useEffect(() => {
    let alive = true;
    async function loadListing() {
      if (!work?.nftObjectId) {
        setListing(null);
        return;
      }
      if (!PACKAGE_ID?.startsWith("0x")) return;
      setListingLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("network", activeNet);
        params.set("workId", work.nftObjectId);
        const res = await fetch(`/api/chainstorm/find-listing?${params.toString()}`);
        const data = await res.json();
        if (!alive) return;
        if (!data?.ok || !data?.data) {
          setListing(null);
          return;
        }
        setListing(data.data);
      } catch {
        if (alive) setListing(null);
      } finally {
        if (alive) setListingLoading(false);
      }
    }
    loadListing();
    return () => {
      alive = false;
    };
  }, [work?.nftObjectId, PACKAGE_ID, activeNet]);

  /* ================= SYNC OWNER ================= */

  async function syncOwner() {
    if (!work?.nftObjectId) return;
    setSyncing(true);
    try {
      const owner = await fetchObjectOwnerAddress(suiClient, work.nftObjectId);
      if (owner && owner.toLowerCase() !== (work.authorWallet || "").toLowerCase()) {
        updateNFTOwner({ workId: work.id, newOwner: owner });
        setWork((prev: any) => ({ ...prev, authorWallet: owner }));
      }
    } catch (e) {
      console.error(e);
      showToast("Không đọc được owner từ chain", "warning");
    } finally {
      setSyncing(false);
    }
  }

  // poll owner mỗi 10s
  useEffect(() => {
    if (!work?.nftObjectId) return;
    const t = setInterval(syncOwner, 10_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [work?.nftObjectId, work?.id]);

  /* ================= BUY LICENSE ================= */

  async function buyLicense() {
    if (!work) return;

    if (!currentAccount) {
      showToast("You need to connect your wallet to buy a license", "warning");
      return;
    }

    if (!PACKAGE_ID?.startsWith("0x")) {
      showToast(`Missing packageId for network ${activeNet}`, "error");
      return;
    }

    if (work.sellType !== "license") {
      showToast("Tác phẩm này không bán theo license", "warning");
      return;
    }

    if (!work.nftObjectId) {
      showToast("Tác phẩm chưa có WorkNFT", "error");
      return;
    }

    const royalty = typeof work.royalty === "number" ? work.royalty : 10;

    try {
      setBuying(true);
      showToast("Đang tạo giao dịch mua license...", "info");

      const tx = new Transaction();

      // Move: issue_license(work_id: address, licensee: address, royalty: u8, ctx)
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::${ISSUE_LICENSE_FN}`,
        arguments: [
          tx.pure.address(work.nftObjectId),
          tx.pure.address(currentAccount.address),
          tx.pure.u8(Math.floor(royalty)),
        ],
      });

      const result = await signAndExecuteTransaction({
        transaction: tx,
      });

      bindLicenseToWork({
        workId: work.id,
        licensee: currentAccount.address,
        royalty,
        txDigest: result.digest,
      });

      // update local UI
      setWork((prev: any) => ({
        ...prev,
        licenses: [
          ...(prev.licenses ?? []),
          {
            licensee: currentAccount.address,
            royalty,
            txDigest: result.digest,
            issuedAt: new Date().toISOString(),
          },
        ],
      }));

      const userId = (user?.id || user?.email || "").trim();
      if (userId) {
        addTrade(userId, {
          id: crypto.randomUUID(),
          type: "license",
          title: work.title || "License",
          amountSui: 0,
          txHash: result.digest,
          status: "pending",
          createdAt: Date.now(),
          workId: work.id,
        });
      }

      showToast("✅ Mua license thành công", "success");
    } catch (e) {
      console.error(e);
      showToast("Mua license thất bại", "error");
    } finally {
      setBuying(false);
    }
  }

  function extractCreatedObjectId(changes: any[] | undefined): string | null {
    if (!Array.isArray(changes)) return null;
    const created = changes.find(
      (c) =>
        c?.type === "created" &&
        typeof c?.objectType === "string" &&
        c.objectType.includes(`${PACKAGE_ID}::${MODULE}::WorkNFT`) &&
        c?.objectId
    );
    return created?.objectId || null;
  }

  async function findOwnedWorkNFTByHash(fileHashHex: string, metaHashHex: string) {
    const fileAddr = normalizeHashToAddress(fileHashHex);
    const metaAddr = normalizeHashToAddress(metaHashHex);
    if (!fileAddr && !metaAddr) return null;
    const type = `${PACKAGE_ID}::${MODULE}::WorkNFT`;
    const owned = await suiClient.getOwnedObjects({
      owner: currentAccount?.address,
      filter: { StructType: type },
      options: { showContent: true },
      limit: 50,
    } as any);
    const hit = (owned.data || []).find((obj: any) => {
      const fields = obj?.data?.content?.fields || {};
      const fh = String(fields?.file_hash || "").toLowerCase();
      const mh = String(fields?.meta_hash || "").toLowerCase();
      return (fileAddr && fh === fileAddr) || (metaAddr && mh === metaAddr);
    });
    return hit?.data?.objectId || null;
  }

  async function findWorkNFTByHashGlobal(fileHashHex: string, metaHashHex: string) {
    const fileAddr = normalizeHashToAddress(fileHashHex);
    const metaAddr = normalizeHashToAddress(metaHashHex);
    if (!fileAddr && !metaAddr) return null;
    const type = `${PACKAGE_ID}::${MODULE}::WorkNFT`;
    const query = (suiClient as any)?.queryObjects;
    if (typeof query !== "function") return null;
    let cursor: string | null | undefined = null;
    for (let i = 0; i < 5; i += 1) {
      const res: any = await query({
        query: { MoveStructType: type },
        options: { showContent: true },
        limit: 50,
        cursor,
      } as any);
      const hit = (res.data || []).find((obj: any) => {
        const fields = obj?.data?.content?.fields || {};
        const fh = String(fields?.file_hash || "").toLowerCase();
        const mh = String(fields?.meta_hash || "").toLowerCase();
        return (fileAddr && fh === fileAddr) || (metaAddr && mh === metaAddr);
      });
      if (hit?.data?.objectId || hit?.objectId) {
        return hit?.data?.objectId || hit?.objectId;
      }
      if (!res.hasNextPage) break;
      cursor = res.nextCursor;
    }
    return null;
  }

  async function findWorkNFTByHashViaApi(fileHashHex: string, metaHashHex: string) {
    try {
      const params = new URLSearchParams();
      params.set("network", activeNet);
      if (fileHashHex) params.set("fileHash", fileHashHex);
      if (metaHashHex) params.set("metaHash", metaHashHex);
      const res = await fetch(`/api/chainstorm/find-nft?${params.toString()}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.ok) return null;
      return data?.data || null;
    } catch {
      return null;
    }
  }

  async function findWorkNFTByHashViaWorksApi(fileHashHex: string, metaHashHex: string) {
    try {
      const params = new URLSearchParams();
      params.set("network", activeNet);
      params.set("force", "1");
      const res = await fetch(`/api/chainstorm/works?${params.toString()}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.ok || !Array.isArray(data?.works)) return null;
      const targetFile = normalizeHashToAddress(fileHashHex);
      const targetMeta = normalizeHashToAddress(metaHashHex);
      if (!targetFile && !targetMeta) return null;
      const hit = data.works.find((w: any) => {
        const fh = String(w?.fileHash || "").toLowerCase();
        const mh = String(w?.metaHash || "").toLowerCase();
        return (targetFile && fh === targetFile) || (targetMeta && mh === targetMeta);
      });
      if (!hit?.nftObjectId) return null;
      return { objectId: hit.nftObjectId, owner: null };
    } catch {
      return null;
    }
  }

  async function handleFindByHash() {
    if (!work) return;
    const fileHash = String(work.fileHash || "").trim();
    const metaHash = String(work.metaHash || "").trim();
    if (!fileHash && !metaHash) {
      showToast("Work thiếu hash để tìm NFT", "warning");
      return;
    }
    try {
      setLookupBusy(true);
      const apiHit = await findWorkNFTByHashViaApi(fileHash, metaHash);
      if (apiHit?.objectId) {
        setLookupResult(apiHit);
        showToast("Đã tìm thấy NFT theo hash", "success");
        return;
      }
      const worksHit = await findWorkNFTByHashViaWorksApi(fileHash, metaHash);
      if (worksHit?.objectId) {
        const owner = await fetchObjectOwnerAddress(suiClient, worksHit.objectId);
        setLookupResult({ objectId: worksHit.objectId, owner: owner || undefined });
        showToast("Đã tìm thấy NFT theo hash", "success");
        return;
      }
      setLookupResult(null);
      showToast("Không tìm thấy NFT theo hash", "warning");
    } catch (e) {
      console.error(e);
      showToast("Tìm NFT theo hash thất bại", "error");
    } finally {
      setLookupBusy(false);
    }
  }

  function getSellTypeU8(sellType?: string) {
    if (sellType === "license") return 2;
    return 1;
  }

  async function remintWorkNFT() {
    if (!work) return null;
    if (!currentAccount) {
      showToast("You need to connect your wallet to remint", "warning");
      return null;
    }
    if (!PACKAGE_ID?.startsWith("0x") || !REGISTRY_ID?.startsWith("0x")) {
      showToast(`Missing on-chain config for ${activeNet}`, "error");
      return null;
    }

    const fileHash = String(work.fileHash || "").trim();
    const metaHash = String(work.metaHash || "").trim();
    if (!fileHash || !metaHash) {
      showToast("Thiếu hash để remint. Vui lòng submit lại work.", "error");
      return null;
    }

    try {
      const existing = await findOwnedWorkNFTByHash(fileHash, metaHash);
      if (existing) {
        bindNFTToWork({
          workId: work.id,
          nftObjectId: existing,
          packageId: PACKAGE_ID,
          txDigest: work.txDigest || "",
          authorWallet: currentAccount.address,
        });
        setWork((prev: any) => ({
          ...prev,
          nftObjectId: existing,
          nftPackageId: PACKAGE_ID,
          authorWallet: currentAccount.address,
        }));
        showToast("Đã tìm thấy NFT trên chain và bind lại.", "success");
        return existing;
      }

      setListingBusy(true);
      showToast("Đang remint WorkNFT (package mới)...", "info");

      const fileHashBytes32 = hexToBytes32(fileHash);
      const metaHashBytes32 = hexToBytes32(metaHash);
      const walrusFileId = strToBytes(String(work.walrusFileId || ""));
      const walrusMetaId = strToBytes(String(work.walrusMetaId || ""));
      const authorSig = strToBytes(String(work.authorSignature || ""));
      const tsaId = strToBytes(String(work.tsaId || ""));
      const tsaSig = strToBytes(String(work.tsaSignature || ""));
      const approvalSig = strToBytes(String(work.approvalSignature || ""));
      const proofId = strToBytes(String(work.proofId || ""));
      const tsaTime = Math.max(0, Math.floor(Number(work.tsaTime || 0)));
      const sellTypeU8 = getSellTypeU8(work.sellType);
      const royalty = Math.max(0, Math.min(100, Math.floor(Number(work.royalty || 0))));

      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::${MINT_FN}`,
        arguments: [
          tx.object(REGISTRY_ID),
          tx.pure.vector("u8", Array.from(fileHashBytes32)),
          tx.pure.vector("u8", Array.from(metaHashBytes32)),
          tx.pure.vector("u8", Array.from(walrusFileId)),
          tx.pure.vector("u8", Array.from(walrusMetaId)),
          tx.pure.vector("u8", Array.from(authorSig)),
          tx.pure.vector("u8", Array.from(tsaId)),
          tx.pure.vector("u8", Array.from(tsaSig)),
          tx.pure.u64(tsaTime),
          tx.pure.vector("u8", Array.from(approvalSig)),
          tx.pure.vector("u8", Array.from(proofId)),
          tx.pure.u8(sellTypeU8),
          tx.pure.u8(royalty),
        ],
      });

      const result = await signAndExecuteTransaction({
        transaction: tx,
      });
      const digest = (result as any)?.digest as string | undefined;
      if (!digest) {
        showToast("Mint failed (no digest)", "error");
        return null;
      }

      let createdObjectId: string | null = null;
      const changes = (result as any)?.objectChanges as any[] | undefined;
      createdObjectId = extractCreatedObjectId(changes);

      if (!createdObjectId) {
        try {
          await suiClient.waitForTransaction({ digest });
        } catch {}

        for (let i = 0; i < 3 && !createdObjectId; i += 1) {
          const txb = await suiClient.getTransactionBlock({
            digest,
            options: { showObjectChanges: true, showEffects: true },
          });
          const oc = (txb as any)?.objectChanges as any[] | undefined;
          createdObjectId = extractCreatedObjectId(oc);
          if (!createdObjectId) {
            await new Promise((r) => setTimeout(r, 250));
          }
        }
      }

      if (!createdObjectId) {
        try {
          createdObjectId = await findOwnedWorkNFTByHash(fileHash, metaHash);
        } catch (e) {
          console.error(e);
        }
      }

      if (!createdObjectId) {
        showToast("Mint xong nhưng không đọc được NFT ID", "error");
        return null;
      }

      bindNFTToWork({
        workId: work.id,
        nftObjectId: createdObjectId,
        packageId: PACKAGE_ID,
        txDigest: digest,
        authorWallet: currentAccount.address,
      });

      setWork((prev: any) => ({
        ...prev,
        nftObjectId: createdObjectId,
        nftPackageId: PACKAGE_ID,
        txDigest: digest,
        authorWallet: currentAccount.address,
      }));

      showToast("Remint thành công.", "success");
      return createdObjectId;
    } catch (e) {
      console.error(e);
      try {
        const existing = await findOwnedWorkNFTByHash(fileHash, metaHash);
        if (existing) {
          bindNFTToWork({
            workId: work.id,
            nftObjectId: existing,
            packageId: PACKAGE_ID,
            txDigest: work.txDigest || "",
            authorWallet: currentAccount.address,
          });
          setWork((prev: any) => ({
            ...prev,
            nftObjectId: existing,
            nftPackageId: PACKAGE_ID,
            authorWallet: currentAccount.address,
          }));
          showToast("Đã tìm thấy NFT trên chain và bind lại.", "success");
          return existing;
        }
        const msg = String((e as any)?.message || e);
        if (msg.includes("100") || msg.toLowerCase().includes("duplicate")) {
          let globalId: string | null = null;
          let owner: string | null = null;
          globalId = await findWorkNFTByHashGlobal(fileHash, metaHash);
          if (globalId) {
            owner = await fetchObjectOwnerAddress(suiClient, globalId);
          } else {
            const apiHit = await findWorkNFTByHashViaApi(fileHash, metaHash);
            if (apiHit?.objectId) {
              globalId = apiHit.objectId;
              owner = apiHit.owner || null;
            } else {
              const worksHit = await findWorkNFTByHashViaWorksApi(fileHash, metaHash);
              if (worksHit?.objectId) {
                globalId = worksHit.objectId;
                if (globalId) {
                  owner = await fetchObjectOwnerAddress(suiClient, globalId);
                }
              }
            }
          }
          if (globalId && owner) {
            if (owner.toLowerCase() === currentAccount.address.toLowerCase()) {
              bindNFTToWork({
                workId: work.id,
                nftObjectId: globalId,
                packageId: PACKAGE_ID,
                txDigest: work.txDigest || "",
                authorWallet: currentAccount.address,
              });
              setWork((prev: any) => ({
                ...prev,
                nftObjectId: globalId,
                nftPackageId: PACKAGE_ID,
                authorWallet: currentAccount.address,
              }));
              showToast("Đã tìm thấy NFT trùng hash và bind lại.", "success");
              return globalId;
            }
            showToast(`NFT đã tồn tại, owner: ${shortAddr(owner)}`, "warning");
            return null;
          }
        }
      } catch (e2) {
        console.error(e2);
      }
      showToast("Remint thất bại", "error");
      return null;
    } finally {
      setListingBusy(false);
    }
  }

  async function ensureListableNFT() {
    if (!work) return null;
    if (!currentAccount) {
      showToast("You need to connect your wallet to list", "warning");
      return null;
    }
    if (!work.nftObjectId) {
      return await remintWorkNFT();
    }

    try {
      const obj = await suiClient.getObject({
        id: work.nftObjectId,
        options: { showOwner: true, showType: true },
      });
      const type = String(obj?.data?.type || "");
      const expected = `${PACKAGE_ID}::${MODULE}::WorkNFT`;

      if (!type || type !== expected) {
        return await remintWorkNFT();
      }

      const owner = (obj?.data?.owner as any)?.AddressOwner as string | undefined;
      if (owner && owner.toLowerCase() !== currentAccount.address.toLowerCase()) {
        showToast("Ví hiện tại không sở hữu NFT này.", "warning");
        return null;
      }

      return work.nftObjectId;
    } catch (e) {
      console.error(e);
      return await remintWorkNFT();
    }
  }

  async function listExclusive() {
    if (!PACKAGE_ID?.startsWith("0x")) {
      showToast(`Missing packageId for network ${activeNet}`, "error");
      return;
    }
    const nftObjectId = await ensureListableNFT();
    if (!nftObjectId) return;
    const priceMist = BigInt(Math.floor(Number(listingPrice || 0) * 1_000_000_000));
    if (!priceMist || priceMist <= BigInt(0)) {
      showToast("Giá không hợp lệ", "warning");
      return;
    }
    try {
      setListingBusy(true);
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::list_nft`,
        arguments: [tx.object(nftObjectId), tx.pure.u64(priceMist)],
      });
      await signAndExecuteTransaction({ transaction: tx });
      showToast("Đã niêm yết", "success");
      setListing(null);
    } catch (e) {
      console.error(e);
      showToast("Niêm yết thất bại", "error");
    } finally {
      setListingBusy(false);
    }
  }

  async function cancelListing() {
    if (!listing?.id) return;
    try {
      setListingBusy(true);
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::cancel_listing`,
        arguments: [tx.object(listing.id)],
      });
      await signAndExecuteTransaction({ transaction: tx });
      setListing(null);
      showToast("Đã huỷ niêm yết", "success");
    } catch (e) {
      console.error(e);
      showToast("Huỷ niêm yết thất bại", "error");
    } finally {
      setListingBusy(false);
    }
  }

  async function buyExclusive() {
    if (!listing?.id) return;
    if (!currentAccount) {
      showToast("You need to connect your wallet to buy", "warning");
      return;
    }
    try {
      setListingBusy(true);
      const priceMist = BigInt(String(listing.price || 0));
      const tx = new Transaction();
      const [paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(priceMist)]);
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::buy_nft`,
        arguments: [tx.object(listing.id), paymentCoin],
      });
      const result = await signAndExecuteTransaction({ transaction: tx });
      updateNFTOwner({ workId: work.id, newOwner: currentAccount.address });
      setListing(null);
      addTrade(user?.id || user?.email || "", {
        id: crypto.randomUUID(),
        type: "buy",
        title: work.title || "Buy NFT",
        amountSui: Number(priceMist) / 1e9,
        txHash: result.digest,
        status: "pending",
        createdAt: Date.now(),
        workId: work.id,
      });
      showToast("Đã mua thành công", "success");
    } catch (e) {
      console.error(e);
      showToast("Mua thất bại", "error");
    } finally {
      setListingBusy(false);
    }
  }

  /* ================= RENDER ================= */

  if (!work) {
    return (
      <main style={{ padding: 28, maxWidth: 900, margin: "0 auto", opacity: 0.8 }}>
        Đang tải...
      </main>
    );
  }

  const cover = resolveCover(meta, work);
  const mediaUrl = resolveMedia(meta, work);
  const mediaKind = mediaUrl ? guessMediaKind(meta, mediaUrl) : "other";
  const authorEmail = resolveAuthorEmail(meta, work);
  const authorWallet = String(work.authorWallet || work.authorId || "").trim();
  const isOwner =
    !!currentAccount?.address &&
    authorWallet &&
    currentAccount.address.toLowerCase() === authorWallet.toLowerCase();

  return (
    <main style={{ padding: 28, maxWidth: 900, margin: "0 auto" }}>
      <div
        style={{
          border: "1px solid rgba(255,255,255,.10)",
          borderRadius: 18,
          padding: 18,
          background: "rgba(255,255,255,.03)",
        }}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 16 }}>
            <div
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,.10)",
                background: "rgba(15,23,42,.6)",
              }}
            >
              {cover ? (
                <img
                  src={cover}
                  alt="Cover"
                  loading="lazy"
                  decoding="async"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: "rgba(226,232,240,.6)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  No cover
                </div>
              )}
            </div>

            <div>
              <h1>{meta?.name || meta?.title || work.title}</h1>
              <p style={{ opacity: 0.8, marginTop: 6 }}>
                Network: <b>{activeNet}</b> • pkg: <b>{shortAddr(PACKAGE_ID)}</b>
                {syncing ? <span style={{ marginLeft: 10, opacity: 0.7 }}>syncing...</span> : null}
              </p>
              <p>
                <b>Mode:</b> {work.sellType}
              </p>
              {listing ? (
                <p>
                  <b>Status:</b> Listed • {toSui(listing.price)} SUI
                </p>
              ) : work?.sales?.length ? (
                <p>
                  <b>Status:</b> Sold
                </p>
              ) : work.nftObjectId ? (
                <p>
                  <b>Status:</b> Minted
                </p>
              ) : (
                <p>
                  <b>Status:</b> Not minted
                </p>
              )}
              <p>
                <b>NFT:</b>{" "}
                {work.nftObjectId ? (
                  <a
                    href={explorerObjUrl(activeNet, work.nftObjectId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shortAddr(work.nftObjectId)}
                  </a>
                ) : (
                  "Not minted"
                )}
              </p>
              <p>
                <b>Owner:</b> {work.authorWallet ? shortAddr(work.authorWallet) : "—"}
              </p>
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(255,255,255,.10)",
              borderRadius: 14,
              padding: 12,
              background: "rgba(2,6,23,.6)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
              {metaLoading ? "Loading preview..." : "Preview"}
            </div>
            {mediaUrl ? (
              mediaKind === "audio" ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <Waveform url={mediaUrl} />
                  <audio controls preload="metadata" src={mediaUrl} style={{ width: "100%" }} />
                </div>
              ) : mediaKind === "video" ? (
                <video controls preload="metadata" src={mediaUrl} style={{ width: "100%", maxHeight: 360 }} />
              ) : mediaKind === "image" ? (
                <img
                  src={mediaUrl}
                  alt="Preview"
                  loading="lazy"
                  decoding="async"
                  style={{ width: "100%", maxHeight: 360, objectFit: "contain" }}
                />
              ) : mediaKind === "pdf" ? (
                <iframe
                  title="PDF preview"
                  src={mediaUrl}
                  style={{ width: "100%", height: 520, border: "none" }}
                />
              ) : (
                <a href={mediaUrl} target="_blank" rel="noreferrer">
                  Open file
                </a>
              )
            ) : (
              <div style={{ opacity: 0.7 }}>No preview available.</div>
            )}
          </div>
        </div>

        {work.sellType === "license" && (
          <>
            <hr style={{ opacity: 0.2, margin: "14px 0" }} />

            <button
              id="rent"
              onClick={buyLicense}
              disabled={buying || isPending}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(250,204,21,.28)",
                background: "rgba(250,204,21,.16)",
                fontWeight: 900,
                cursor: buying || isPending ? "not-allowed" : "pointer",
                opacity: buying || isPending ? 0.7 : 1,
              }}
            >
              {buying ? "Đang thuê..." : "Thuê license"}
            </button>

            {authorEmail ? (
              <a
                href={`mailto:${authorEmail}?subject=${encodeURIComponent(
                  `License request: ${meta?.name || meta?.title || work.title}`
                )}`}
                style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(56,189,248,.35)",
                  background: "rgba(56,189,248,.12)",
                  fontWeight: 800,
                  textDecoration: "none",
                  color: "#a5f3fc",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                Liên hệ thuê
              </a>
            ) : null}

            <h3 style={{ marginTop: 20 }}>License history</h3>

            {licenses.length === 0 ? (
              <div style={{ opacity: 0.7 }}>Chưa có license nào</div>
            ) : (
              licenses
                .slice()
                .reverse()
                .map((l: any, idx: number) => (
                  <div key={idx} style={{ marginTop: 10 }}>
                    <div>
                      <b>Licensee:</b> {shortAddr(l.licensee)}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {new Date(l.issuedAt).toLocaleString()}
                    </div>
                    <a
                      href={explorerTxUrl(activeNet, l.txDigest)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12 }}
                    >
                      tx
                    </a>
                  </div>
                ))
            )}
          </>
        )}

        {work.sellType === "exclusive" && (
          <>
            <hr style={{ opacity: 0.2, margin: "14px 0" }} />
            <div id="buy" style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>Mua bản quyền độc quyền</div>
              {listingLoading ? (
                <div style={{ fontSize: 13, opacity: 0.75 }}>Đang kiểm tra niêm yết...</div>
              ) : listing ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 13, opacity: 0.85 }}>
                    Giá niêm yết: <b>{toSui(listing.price)} SUI</b>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {!isOwner ? (
                      <button
                        type="button"
                        onClick={buyExclusive}
                        disabled={listingBusy || isPending}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid rgba(250,204,21,.35)",
                          background: "rgba(250,204,21,.12)",
                          fontWeight: 800,
                          color: "#fde047",
                          cursor: listingBusy ? "not-allowed" : "pointer",
                        }}
                      >
                        {listingBusy ? "Đang mua..." : "Mua ngay"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={cancelListing}
                        disabled={listingBusy || isPending}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid rgba(239,68,68,.35)",
                          background: "rgba(239,68,68,.12)",
                          fontWeight: 800,
                          color: "#fecaca",
                          cursor: listingBusy ? "not-allowed" : "pointer",
                        }}
                      >
                        {listingBusy ? "Đang huỷ..." : "Huỷ niêm yết"}
                      </button>
                    )}
                  </div>
                </div>
              ) : isOwner ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 13, opacity: 0.75 }}>
                    Chưa niêm yết. Nhập giá để bán on-chain.
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      value={listingPrice}
                      onChange={(e) => setListingPrice(e.target.value)}
                      placeholder="Giá SUI"
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,.12)",
                        background: "rgba(15,23,42,.6)",
                        color: "#e5e7eb",
                      }}
                    />
                    <button
                      type="button"
                      onClick={listExclusive}
                      disabled={listingBusy || isPending}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(56,189,248,.35)",
                        background: "rgba(56,189,248,.12)",
                        fontWeight: 800,
                        color: "#a5f3fc",
                        cursor: listingBusy ? "not-allowed" : "pointer",
                      }}
                    >
                      {listingBusy ? "Đang niêm yết..." : "Niêm yết"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {authorEmail ? (
                    <a
                      href={`mailto:${authorEmail}?subject=${encodeURIComponent(
                        `Purchase request: ${meta?.name || meta?.title || work.title}`
                      )}`}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(56,189,248,.35)",
                        background: "rgba(56,189,248,.12)",
                        fontWeight: 800,
                        textDecoration: "none",
                        color: "#a5f3fc",
                      }}
                    >
                      Liên hệ mua
                    </a>
                  ) : (
                    <span style={{ fontSize: 13, opacity: 0.7 }}>
                      Không có email tác giả. Ví: {shortAddr(authorWallet)}
                    </span>
                  )}
                </div>
              )}

              {!isOwner ? (
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={handleFindByHash}
                    disabled={lookupBusy}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(148,163,184,.25)",
                      background: "rgba(15,23,42,.55)",
                      fontWeight: 700,
                      color: "#cbd5f5",
                      cursor: lookupBusy ? "not-allowed" : "pointer",
                    }}
                  >
                    {lookupBusy ? "Đang tìm NFT..." : "Tìm NFT theo hash (buyer)"}
                  </button>
                  {lookupResult?.objectId ? (
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      Found:{" "}
                      <a
                        href={explorerObjUrl(activeNet, lookupResult.objectId)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {shortAddr(lookupResult.objectId)}
                      </a>
                      {lookupResult.owner ? ` • Owner: ${shortAddr(lookupResult.owner)}` : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
