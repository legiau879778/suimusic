"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  bindLicenseToWork,
  getWorkById,
  syncWorksFromChain,
  updateNFTOwner,
} from "@/lib/workStore";
import { useToast } from "@/context/ToastContext";
import { toGateway } from "@/lib/profileStore";

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

/* ================= HELPERS ================= */

function shortAddr(a?: string) {
  if (!a) return "—";
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function explorerTxUrl(net: "devnet" | "testnet" | "mainnet", digest: string) {
  return `https://suiexplorer.com/txblock/${digest}?network=${net}`;
}

function explorerObjUrl(net: "devnet" | "testnet" | "mainnet", objectId: string) {
  return `https://suiexplorer.com/object/${objectId}?network=${net}`;
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

function guessMediaKind(meta: any, url: string): "audio" | "video" | "image" | "other" {
  const mime =
    String(meta?.file?.mime || meta?.file?.type || meta?.properties?.file?.type || "")
      .toLowerCase()
      .trim();
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";

  const u = url.toLowerCase();
  if (/\.(mp3|wav|ogg|m4a|flac)$/.test(u)) return "audio";
  if (/\.(mp4|webm|mov|mkv)$/.test(u)) return "video";
  if (/\.(png|jpg|jpeg|webp|gif|bmp|svg)$/.test(u)) return "image";
  return "other";
}

/* ================= COMPONENT ================= */

export default function MarketplaceDetailPage() {
  const params = useParams<{ id: string }>();
  const workId = params?.id;
  const router = useRouter();
  const { showToast } = useToast();

  const suiClient = useSuiClient();
  const suiCtx = useSuiClientContext();
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();

  // ✅ same network detection as register-work
  const activeNet = normalizeSuiNet(suiCtx?.network);
  const cfg = getChainstormConfig(activeNet);

  const PACKAGE_ID = cfg?.packageId || "";
  const MODULE = cfg?.module || "chainstorm_nft";
  const ISSUE_LICENSE_FN = "issue_license"; // Move fn name in your module

  const [work, setWork] = useState<any | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [buying, setBuying] = useState(false);
  const [meta, setMeta] = useState<any | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

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
        const res = await fetch(metaUrl, { cache: "force-cache" });
        if (!res.ok) {
          if (alive) setMeta(null);
          return;
        }
        const json = await res.json();
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

      showToast("✅ Mua license thành công", "success");
    } catch (e) {
      console.error(e);
      showToast("Mua license thất bại", "error");
    } finally {
      setBuying(false);
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
                <img src={cover} alt="Cover" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                <audio controls src={mediaUrl} style={{ width: "100%" }} />
              ) : mediaKind === "video" ? (
                <video controls src={mediaUrl} style={{ width: "100%", maxHeight: 360 }} />
              ) : mediaKind === "image" ? (
                <img src={mediaUrl} alt="Preview" style={{ width: "100%", maxHeight: 360, objectFit: "contain" }} />
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
              {buying ? "Đang mua..." : "Mua license"}
            </button>

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
      </div>
    </main>
  );
}
