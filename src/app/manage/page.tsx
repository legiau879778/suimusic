"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
type MarketFilter = "all" | "sell" | "license";

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

function toGateway(input?: string) {
  if (!input) return "";

  let v = String(input).trim();

  if (v.startsWith("http://") || v.startsWith("https://")) return v;

  if (v.startsWith("ipfs://")) v = v.slice("ipfs://".length);

  v = v.replace(/^\/+/, "");
  if (v.startsWith("ipfs/")) v = v.slice("ipfs/".length);

  // chặn rác (UUID) tránh spam 400
  if (!v.startsWith("Qm") && !v.startsWith("bafy")) return "";

  return `https://gateway.pinata.cloud/ipfs/${v}`;
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

/** createdDate display for UI (work.createdDate ưu tiên) */
function pickCreatedDate(work: Work, meta: any | null) {
  const w = (work.createdDate || "").trim();
  if (w) return w;

  const m1 = (meta?.properties?.createdDate || "").trim();
  if (m1) return m1;

  const mIso = (meta?.properties?.createdAtISO || "").trim();
  if (mIso) return toDDMMYYYY(mIso);

  return "—";
}

/** SHA-256(CID) -> 0x..(32 bytes hex) to compare with Move `address` */
async function cidToAddressHex(cid: string): Promise<string> {
  const enc = new TextEncoder();
  const raw = enc.encode(cid);
  const hash = await crypto.subtle.digest("SHA-256", raw);
  const bytes = new Uint8Array(hash);
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

function guessKindFromFile(meta: any): "image" | "audio" | "video" | "pdf" | "other" {
  const t: string =
    meta?.properties?.file?.type ||
    meta?.properties?.cover?.type ||
    meta?.mimeType ||
    "";

  const name: string =
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
  const SELL_FN = "sell_nft";
  const ISSUE_LICENSE_FN = "issue_license";

  const [view, setView] = useState<ViewMode>("active");
  const [filter, setFilter] = useState<MarketFilter>("all");

  const [works, setWorks] = useState<Work[]>([]);
  const [page, setPage] = useState(1);

  const prevStatus = useRef<Record<string, string>>({});
  const [syncingOwners, setSyncingOwners] = useState<Record<string, boolean>>({});
  const [syncingAll, setSyncingAll] = useState(false);
  const [selling, setSelling] = useState(false);
  const [licensing, setLicensing] = useState(false);

  const [selected, setSelected] = useState<Work | null>(null);

  /* ================= Load list ================= */

  function load() {
    if (!user) {
      setWorks([]);
      return;
    }

    const base = view === "trash" ? getTrashWorks() : getActiveWorks();
    let list = user.role === "admin" ? base : base.filter((w) => w.authorId === user.id);

    if (filter !== "all") {
      list = list.filter(
        (w) =>
          (filter === "sell" && w.sellType === "exclusive") ||
          (filter === "license" && w.sellType === "license")
      );
    }

    list.forEach((w) => {
      const prev = prevStatus.current[w.id];
      if (prev && prev !== w.status) {
        showToast(
          `Tác phẩm "${w.title}" ${
            w.status === "verified" ? "đã được duyệt" : "bị từ chối"
          }`,
          w.status === "verified" ? "success" : "warning"
        );
      }
      prevStatus.current[w.id] = w.status;
    });

    setWorks(list as Work[]);
  }

  useEffect(() => {
    autoCleanTrash();
    load();
    window.addEventListener("works_updated", load);
    return () => window.removeEventListener("works_updated", load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, filter, user]);

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

  async function syncOneWorkFromChain(w: Work) {
    if (!PACKAGE_ID?.startsWith("0x")) return;

    if (w.nftObjectId) {
      const obj = await suiClient.getObject({
        id: w.nftObjectId,
        options: { showOwner: true },
      });
      const owner = (obj as any)?.data?.owner?.AddressOwner as string | undefined;
      if (owner && owner.toLowerCase() !== (w.authorWallet || "").toLowerCase()) {
        updateNFTOwner({ workId: w.id, newOwner: owner });
      }
      return;
    }

    const cid = (w.hash || "").trim();
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
  }

  async function handleSyncAll(reason?: string) {
    if (!currentAccount?.address) {
      showToast("Vui lòng kết nối ví để sync", "warning");
      return;
    }
    if (!PACKAGE_ID?.startsWith("0x")) {
      showToast(`Thiếu packageId cho network ${activeNet}`, "error");
      return;
    }

    try {
      setSyncingAll(true);
      if (reason) showToast(reason, "info");
      else showToast("Đang auto-sync NFT từ chain...", "info");

      const base = getActiveWorks();
      const list = user?.role === "admin" ? base : base.filter((x) => x.authorId === user?.id);

      const candidates = list.filter((w) => !!w.hash || !!w.nftObjectId);
      const toProcess = candidates.slice(0, 6);

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
    if (!user) return;
    if (!currentAccount?.address) return;
    if (!PACKAGE_ID?.startsWith("0x")) return;
    if (view !== "active") return;

    const t = setInterval(() => {
      if (syncingAll || isPending) return;
      void (async () => {
        try {
          const base = getActiveWorks();
          const list = user.role === "admin" ? base : base.filter((x) => x.authorId === user.id);
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
  }, [user, currentAccount?.address, PACKAGE_ID, view, syncingAll, isPending]);

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
        showToast("Không đọc được owner từ chain", "warning");
        return;
      }

      updateNFTOwner({ workId: work.id, newOwner: owner });
      showToast(`Đã sync owner: ${shortAddr(owner)}`, "success");
    } catch (e) {
      console.error(e);
      showToast("Sync owner thất bại", "error");
    } finally {
      setSyncingOwners((m) => ({ ...m, [work.id]: false }));
    }
  }

  async function handleSellNFT(work: Work) {
    if (!currentAccount) {
      showToast("Vui lòng kết nối ví", "warning");
      return;
    }
    if (!PACKAGE_ID?.startsWith("0x")) {
      showToast(`Thiếu packageId cho network ${activeNet}`, "error");
      return;
    }
    if (!work.nftObjectId) {
      showToast("Tác phẩm chưa bind NFT (bấm Auto-sync NFT)", "warning");
      return;
    }

    const buyer = prompt("Nhập ví người mua (0x...):");
    if (!buyer) return;

    const priceStr = prompt("Nhập giá (SUI)", "1");
    if (!priceStr) return;

    const priceMist = BigInt(Math.floor(Number(priceStr) * 1_000_000_000));
    if (priceMist <= BigInt(0)) {
      showToast("Giá không hợp lệ", "warning");
      return;
    }

    try {
      setSelling(true);
      showToast("Đang xử lý giao dịch bán NFT...", "info");

      const tx = new Transaction();
      const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(priceMist)]);

      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::${SELL_FN}`,
        arguments: [
          tx.object(work.nftObjectId),
          payment,
          tx.pure.u64(priceMist),
          tx.pure.address(buyer),
        ],
      });

      const result = await signAndExecuteTransaction({
        transaction: tx,
        execute: { options: { showEffects: true, showObjectChanges: true } },
      });

      markWorkSold({
        workId: work.id,
        buyerWallet: buyer,
        txDigest: result.digest,
        priceMist: priceMist.toString(),
      });

      showToast("🎉 Bán NFT thành công", "success");
    } catch (e) {
      console.error(e);
      showToast("Giao dịch thất bại", "error");
    } finally {
      setSelling(false);
    }
  }

  async function handleIssueLicense(work: Work) {
    if (!currentAccount) {
      showToast("Vui lòng kết nối ví", "warning");
      return;
    }
    if (!PACKAGE_ID?.startsWith("0x")) {
      showToast(`Thiếu packageId cho network ${activeNet}`, "error");
      return;
    }
    if (!work.nftObjectId) {
      showToast("Tác phẩm chưa bind WorkNFT (bấm Auto-sync NFT)", "warning");
      return;
    }

    const licensee = prompt("Nhập ví người mua license (0x...):");
    if (!licensee) return;

    const royalty = Number(prompt("Royalty % (0-100)", String(work.royalty ?? 10)));
    if (Number.isNaN(royalty) || royalty < 0 || royalty > 100) {
      showToast("Royalty không hợp lệ", "warning");
      return;
    }

    try {
      setLicensing(true);
      showToast("Đang cấp license...", "info");

      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::${ISSUE_LICENSE_FN}`,
        arguments: [
          tx.pure.address(work.nftObjectId), // work_id: address
          tx.pure.address(licensee),
          tx.pure.u8(Math.floor(royalty)),
        ],
      });

      const result = await signAndExecuteTransaction({
        transaction: tx,
        execute: { options: { showEffects: true, showObjectChanges: true } },
      });

      bindLicenseToWork({
        workId: work.id,
        licensee,
        royalty,
        txDigest: result.digest,
      });

      showToast("✅ Cấp license thành công", "success");
    } catch (e) {
      console.error(e);
      showToast("Cấp license thất bại", "error");
    } finally {
      setLicensing(false);
    }
  }

  function handleSoftDelete(work: Work) {
    if (!user) return;

    const ok = confirm(`Đưa "${work.title}" vào thùng rác?`);
    if (!ok) return;

    try {
      softDeleteWork({
        workId: work.id,
        actor: { id: user.id, role: user.role },
        walletAddress: currentAccount?.address,
      });
      showToast("🗑️ Đã chuyển vào thùng rác", "success");
    } catch (e: any) {
      console.error(e);
      if (String(e?.message).includes("FORBIDDEN")) {
        showToast("Bạn không có quyền xoá tác phẩm này", "error");
      } else {
        showToast("Xoá thất bại", "error");
      }
    }
  }

  function handleRestore(work: Work) {
    if (!user) return;

    if (user.role !== "admin") {
      showToast("Chỉ admin mới được khôi phục", "warning");
      return;
    }

    const ok = confirm(`Khôi phục "${work.title}"?`);
    if (!ok) return;

    try {
      restoreWork({ workId: work.id, actor: { id: user.id, role: user.role } });
      showToast("♻️ Đã khôi phục tác phẩm", "success");
    } catch (e: any) {
      console.error(e);
      showToast("Khôi phục thất bại", "error");
    }
  }

  /* ================= Render ================= */

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.locked}>
          <h2>Chưa đăng nhập</h2>
          <p>Vui lòng đăng nhập để quản lý tác phẩm.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ===== Header ===== */}
      <div className={styles.header}>
        <div className={styles.headLeft}>
          <h1 className={styles.headTitle}>Quản lý tác phẩm</h1>
          <div className={styles.headSub}>
            Network: <b>{activeNet}</b> • pkg:{" "}
            <b className={styles.mono}>{PACKAGE_ID ? shortAddr(PACKAGE_ID) : "missing"}</b>
          </div>
        </div>

        <div className={styles.headRight}>
          <button className={styles.btnPrimary} onClick={() => router.push("/register-work")}>
            + Đăng ký tác phẩm
          </button>

          <button
            className={styles.btnSecondary}
            onClick={() => handleSyncAll("Đang auto-sync NFT từ chain...")}
            disabled={syncingAll || isPending}
            title="Quét WorkNFT trong ví theo content_hash = sha256(metadataCid)"
          >
            {syncingAll ? "Syncing..." : "Auto-sync NFT"}
          </button>

          <div className={styles.selectWrap}>
            <select
              className={styles.select}
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="all">Tất cả</option>
              <option value="sell">Bán đứt</option>
              <option value="license">License</option>
            </select>

            <select
              className={styles.select}
              value={view}
              onChange={(e) => setView(e.target.value as any)}
            >
              <option value="active">Đang hoạt động</option>
              <option value="trash">Thùng rác</option>
            </select>
          </div>
        </div>
      </div>

      {/* ===== Empty ===== */}
      {works.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🎵</div>
          <div className={styles.emptyTitle}>Chưa có tác phẩm</div>
          <div className={styles.emptySub}>Hãy đăng ký tác phẩm đầu tiên để mint NFT.</div>
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
            selling={selling}
            licensing={licensing}
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
          onSell={() => handleSellNFT(selected)}
          onIssueLicense={() => handleIssueLicense(selected)}
          onSyncOwner={() => handleSyncOwner(selected)}
          onDelete={() => handleSoftDelete(selected)}
          onRestore={() => handleRestore(selected)}
          view={view}
          disableGlobal={isPending || syncingAll}
          selling={selling}
          licensing={licensing}
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

  const [meta, setMeta] = useState<any | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const metaUrl = useMemo(() => cidToGateway(work.hash), [work.hash]);

  useEffect(() => {
    let alive = true;
    if (!metaUrl) {
      setMeta(null);
      return;
    }

    setLoadingMeta(true);
    fetchMetadata(metaUrl)
      .then((m) => {
        if (alive) setMeta(m);
      })
      .finally(() => {
        if (alive) setLoadingMeta(false);
      });

    return () => {
      alive = false;
    };
  }, [metaUrl]);

  const coverUrl = useMemo(() => {
    // ✅ cover riêng ưu tiên
    const cover = normalizeIpfsUrl(meta?.properties?.cover?.url);
    const img = normalizeIpfsUrl(meta?.image);
    return cover || img || "";
  }, [meta]);

  const mediaUrl = useMemo(() => {
    const a = normalizeIpfsUrl(meta?.animation_url);
    const file = normalizeIpfsUrl(meta?.properties?.file?.url);
    return a || file || "";
  }, [meta]);

  const kind = useMemo(() => guessKindFromFile(meta), [meta]);

  const createdText = useMemo(() => pickCreatedDate(work, meta), [work, meta]);

  return (
    <div className={styles.card} onClick={onOpen} role="button" tabIndex={0}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle} title={work.title}>
          {work.title}
        </div>

        <div className={styles.badges}>
          <span className={styles.badge} data-status={work.status}>
            {work.status}
          </span>
          <span className={styles.badge2}>{work.sellType}</span>
        </div>
      </div>

      <div className={styles.preview}>
        {loadingMeta ? (
          <div className={styles.previewLoading}>Loading…</div>
        ) : coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.previewImg} src={coverUrl} alt={work.title} />
        ) : kind === "image" && mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.previewImg} src={mediaUrl} alt={work.title} />
        ) : (
          <div className={styles.previewEmpty}>No cover</div>
        )}

        <div className={styles.previewHint}>
          {kind === "audio" ? "🎵 Audio" : kind === "video" ? "🎬 Video" : kind === "pdf" ? "📄 PDF" : "🧾"}
        </div>

        {/* ✅ NEW: createdDate badge (bottom-right) */}
        <div className={styles.dateBadge} title="Ngày sáng tác">
          {createdText}
        </div>

      </div>

      <div className={styles.info}>
        {/* ✅ ADD createdDate */}
        <div className={styles.kv}>
          <span className={styles.k}>Ngày</span>
          <span className={styles.v}>{createdText}</span>
        </div>

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
              <span className={styles.warnText}>— (chưa bind)</span>
            )}
          </span>
        </div>

        <div className={styles.kv}>
          <span className={styles.k}>Owner</span>
          <span className={styles.v}>{work.authorWallet ? shortAddr(work.authorWallet) : "—"}</span>
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
          title={view === "trash" ? "Khôi phục trước khi thao tác" : "Bán NFT"}
        >
          Bán
        </button>

        <button
          className={styles.actionPrimary}
          onClick={onIssueLicense}
          disabled={view === "trash" || licensing || disableGlobal}
          title={view === "trash" ? "Khôi phục trước khi thao tác" : "Cấp license"}
        >
          License
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

  const coverUrl = useMemo(() => {
    const cover = normalizeIpfsUrl(meta?.properties?.cover?.url);
    const img = normalizeIpfsUrl(meta?.image);
    return cover || img || "";
  }, [meta]);

  const mediaUrl = useMemo(() => {
    const a = normalizeIpfsUrl(meta?.animation_url);
    const file = normalizeIpfsUrl(meta?.properties?.file?.url);
    return a || file || "";
  }, [meta]);

  const kind = useMemo(() => guessKindFromFile(meta), [meta]);

  const createdText = useMemo(() => pickCreatedDate(work, meta), [work, meta]);

  function stop(e: React.MouseEvent) {
    e.stopPropagation();
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div className={styles.modal} onClick={stop} role="dialog" aria-modal="true">
        <div className={styles.modalTop}>
          <div>
            <div className={styles.modalTitle}>{work.title}</div>
            <div className={styles.modalSub}>
              <span className={styles.badge} data-status={work.status}>
                {work.status}
              </span>
              <span className={styles.badge2}>{work.sellType}</span>
              <span className={styles.modalDot}>•</span>
              <span className={styles.mono}>{net}</span>
            </div>
          </div>

          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.modalPreview}>
          {loadingMeta ? (
            <div className={styles.previewLoading}>Loading…</div>
          ) : coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.modalImg} src={coverUrl} alt={work.title} />
          ) : (
            <div className={styles.previewEmpty}>No cover</div>
          )}
          {/* ✅ NEW: createdDate badge (bottom-right) */}
          <div className={styles.dateBadge} title="Ngày sáng tác">
            {createdText}
          </div>
        </div>

        <div className={styles.mediaBox}>
          <div className={styles.mediaHead}>
            <div className={styles.mediaTitle}>Preview</div>
            {mediaUrl ? (
              <a className={styles.link} href={mediaUrl} target="_blank" rel="noreferrer">
                Open file
              </a>
            ) : null}
          </div>

          {!mediaUrl ? (
            <div className={styles.mediaEmpty}>Không có file preview (metadata thiếu animation_url / file.url).</div>
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

        <div className={styles.modalGrid}>
          {/* ✅ ADD createdDate */}
          <KV label="Ngày sáng tác" value={createdText} />

          <KV label="Owner" value={work.authorWallet ? shortAddr(work.authorWallet) : "—"} mono />
          <KV label="Royalty" value={`${work.royalty ?? 0}%`} />

          <KV
            label="NFT"
            value={
              work.nftObjectId ? (
                <a className={styles.link} href={explorerObjUrl(net, work.nftObjectId)} target="_blank" rel="noreferrer">
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
                <a className={styles.link} href={explorerTxUrl(net, work.txDigest)} target="_blank" rel="noreferrer">
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
            value={`${work.authorName || work.authorId}${work.authorPhone ? ` • ${work.authorPhone}` : ""}`}
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
                .map((l, idx) => (
                  <div key={idx} className={styles.licenseItem}>
                    <div className={styles.licenseRow}>
                      <span className={styles.mono}>{shortAddr(l.licensee)}</span>
                      <span className={styles.royaltyPill}>{l.royalty}%</span>
                    </div>
                    <div className={styles.licenseRow2}>
                      <span className={styles.mutedSmall}>{new Date(l.issuedAt).toLocaleString()}</span>
                      <a className={styles.linkSmall} href={explorerTxUrl(net, l.txDigest)} target="_blank" rel="noreferrer">
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
            {selling ? "Đang bán…" : "Bán NFT"}
          </button>

          <button
            className={styles.actionPrimary}
            onClick={onIssueLicense}
            disabled={view === "trash" || licensing || disableGlobal}
          >
            {licensing ? "Đang cấp…" : "Cấp License"}
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
