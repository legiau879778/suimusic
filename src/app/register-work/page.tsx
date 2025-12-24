// src/app/register-work/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./register-work.module.css";

import { useAuth } from "@/context/AuthContext";
import { addWork, bindNFTToWork } from "@/lib/workStore";
import { loadProfile, subscribeProfile } from "@/lib/profileStore";

/* ===== SUI ===== */
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientContext,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";

/* ✅ network-aware config */
import { getChainstormConfig, normalizeSuiNet } from "@/lib/chainstormConfig";

type SellTypeUI = "exclusive" | "license";
type UploadResult = {
  cid: string;
  url: string;
  name?: string;
  size?: number;
  type?: string;
};

/* ================= Utils ================= */

function isDDMMYYYY(v: string) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(v);
}

function parseDDMMYYYYToISO(v: string): string | null {
  if (!isDDMMYYYY(v)) return null;
  const [dd, mm, yyyy] = v.split("/").map((x) => Number(x));
  if (!dd || !mm || !yyyy) return null;

  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (
    d.getUTCFullYear() !== yyyy ||
    d.getUTCMonth() !== mm - 1 ||
    d.getUTCDate() !== dd
  )
    return null;

  return d.toISOString();
}

export default function RegisterWorkPage() {
  const router = useRouter();
  const { user } = useAuth();

  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const suiCtx = useSuiClientContext();
  const { mutateAsync: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();

  const walletAddress = account?.address ?? "";

  const activeNet = normalizeSuiNet(suiCtx?.network);
  const chainCfg = getChainstormConfig(activeNet);

  const PACKAGE_ID = chainCfg?.packageId || "";
  const REGISTRY_ID = chainCfg?.registryId || "";
  const MODULE = chainCfg?.module || "chainstorm_nft";
  const MINT_FN = chainCfg?.mintFn || "mint";

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState("");
  const [createdDate, setCreatedDate] = useState(""); // dd/mm/yyyy

  const [sellType, setSellType] = useState<SellTypeUI>("exclusive");
  const [royalty, setRoyalty] = useState<string>("5");

  // main file
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<
    "idle" | "upload_file" | "upload_cover" | "upload_meta" | "done"
  >("idle");

  const [fileCid, setFileCid] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  // cover (optional but recommended)
  const [cover, setCover] = useState<File | null>(null);
  const [coverCid, setCoverCid] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  // metadata
  const [metaCid, setMetaCid] = useState("");
  const [metaUrl, setMetaUrl] = useState("");

  // author snapshot
  const [authorName, setAuthorName] = useState<string>("Unknown");
  const [authorPhone, setAuthorPhone] = useState<string>("");

  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* =======================
     ✅ profileStore sync
  ======================= */
  useEffect(() => {
    if (!user?.id) return;

    const p = loadProfile(user.id);
    setAuthorName(p?.name?.trim() ? p.name.trim() : user.id);
    setAuthorPhone(p?.phone ?? "");

    const unsub = subscribeProfile(user.id, (profile) => {
      setAuthorName(profile?.name?.trim() ? profile.name!.trim() : user.id);
      setAuthorPhone(profile?.phone ?? "");
    });

    return unsub;
  }, [user?.id]);

  /* =======================
     ✅ computed
  ======================= */
  const royaltyNum = useMemo(() => {
    const n = Number(royalty);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.floor(n)));
  }, [royalty]);

  const sellTypeU8 = useMemo(
    () => (sellType === "exclusive" ? 1 : 2),
    [sellType]
  );

  const configOk = useMemo(() => {
    return Boolean(
      PACKAGE_ID?.startsWith("0x") &&
        REGISTRY_ID?.startsWith("0x") &&
        MODULE &&
        MINT_FN
    );
  }, [PACKAGE_ID, REGISTRY_ID, MODULE, MINT_FN]);

  const createdDateOk = useMemo(() => {
    if (!createdDate.trim()) return true; // optional
    return !!parseDDMMYYYYToISO(createdDate.trim());
  }, [createdDate]);

  const canGoStep1 = useMemo(() => {
    if (title.trim().length < 3) return false;
    if (!file) return false;
    if (!createdDateOk) return false;
    return true;
  }, [title, file, createdDateOk]);

  const canSubmit = useMemo(() => {
    if (!configOk) return false;
    if (!user?.id) return false;
    if (!walletAddress) return false;
    if (!title.trim() || title.trim().length < 3) return false;
    if (!file) return false;
    if (!createdDateOk) return false;
    if (uploading) return false;
    if (isPending) return false;
    return true;
  }, [
    configOk,
    user?.id,
    walletAddress,
    title,
    file,
    createdDateOk,
    uploading,
    isPending,
  ]);

  useEffect(() => setErr(null), [step, sellType, activeNet]);

  function shortCid(cid: string) {
    return cid ? `${cid.slice(0, 10)}…${cid.slice(-6)}` : "";
  }
  function shortAddr(addr: string) {
    return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
  }

  /* =======================
     ✅ IPFS helpers
  ======================= */

  // ✅ FIX: upload file phải gọi /api/ipfs/upload (FormData), KHÔNG gọi upload-json
  async function uploadFileToIPFS(f: File): Promise<UploadResult> {
    setUploading(true);
    setUploadStage("upload_file");
    try {
      const fd = new FormData();
      fd.append("file", f);

      const res = await fetch("/api/ipfs/upload", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok || !data?.ok)
        throw new Error(data?.error || "Upload IPFS failed");

      return {
        cid: data.cid,
        url: data.url,
        name: data.name,
        size: data.size,
        type: data.type,
      };
    } finally {
      setUploading(false);
    }
  }

  async function uploadCoverToIPFS(f: File): Promise<UploadResult> {
    setUploading(true);
    setUploadStage("upload_cover");
    try {
      const fd = new FormData();
      fd.append("file", f);

      const res = await fetch("/api/ipfs/upload", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok || !data?.ok)
        throw new Error(data?.error || "Upload cover failed");

      return {
        cid: data.cid,
        url: data.url,
        name: data.name,
        size: data.size,
        type: data.type,
      };
    } finally {
      setUploading(false);
    }
  }

  async function uploadJSONToIPFS(json: any): Promise<{ cid: string; url: string }> {
    setUploading(true);
    setUploadStage("upload_meta");
    try {
      const res = await fetch("/api/ipfs/upload-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await res.json();

      if (!res.ok || !data?.ok)
        throw new Error(data?.error || "Upload metadata failed");

      setMetaCid(data.cid);
      setMetaUrl(data.url);
      setUploadStage("done");
      return { cid: data.cid, url: data.url };
    } finally {
      setUploading(false);
    }
  }

  /** ✅ CID(string) -> SHA-256 -> 32 bytes vector<u8> */
  async function cidToHashBytes32(cid: string): Promise<Uint8Array> {
    const enc = new TextEncoder();
    const raw = enc.encode(cid);
    const hash = await crypto.subtle.digest("SHA-256", raw);
    return new Uint8Array(hash);
  }

  async function ensureIPFSReady(): Promise<{
    metadataCid: string;
    hashBytes32: Uint8Array;
    resolved: {
      fileCid: string;
      fileUrl: string;
      coverCid?: string;
      coverUrl?: string;
    };
  }> {
    if (!user?.id) throw new Error("Bạn cần đăng nhập.");
    if (!file) throw new Error("Bạn chưa chọn file tác phẩm.");

    // 1) ensure file
    let fCid = fileCid;
    let fUrl = fileUrl;

    if (!fCid) {
      const r = await uploadFileToIPFS(file);
      fCid = r.cid;
      fUrl = r.url;
      setFileCid(r.cid);
      setFileUrl(r.url);
    }
    if (!fCid) throw new Error("Upload file lên IPFS thất bại.");

    // 2) ensure cover (optional)
    let cCid = coverCid;
    let cUrl = coverUrl;

    if (cover && !cCid) {
      const r = await uploadCoverToIPFS(cover);
      cCid = r.cid;
      cUrl = r.url;
      setCoverCid(r.cid);
      setCoverUrl(r.url);
    }

    // 3) metadata JSON
    const profile = loadProfile(user.id);
    const aName = profile?.name?.trim() ? profile.name.trim() : user.id;

    const createdISO = createdDate.trim()
      ? parseDDMMYYYYToISO(createdDate.trim())
      : null;

    if (createdDate.trim() && !createdISO) {
      throw new Error("Ngày sáng tác không hợp lệ. Định dạng đúng: dd/mm/yyyy");
    }

    const metadata = {
      name: title.trim(),
      description: "Chainstorm WorkNFT metadata",
      attributes: [
        { trait_type: "sellType", value: sellType },
        { trait_type: "sell_type_u8", value: sellTypeU8 },
        { trait_type: "royalty_percent", value: royaltyNum },
        ...(category.trim()
          ? [{ trait_type: "category", value: category.trim() }]
          : []),
        ...(language.trim()
          ? [{ trait_type: "language", value: language.trim() }]
          : []),
        ...(createdDate.trim()
          ? [{ trait_type: "createdDate", value: createdDate.trim() }]
          : []),
      ],
      properties: {
        app: "Chainstorm",
        network: activeNet,

        category: category.trim() || "",
        language: language.trim() || "",
        createdDate: createdDate.trim() || "",
        createdAtISO: createdISO || "",

        chainstorm: {
          packageId: PACKAGE_ID,
          registryId: REGISTRY_ID,
          module: MODULE,
          mintFn: MINT_FN,
        },
        author: {
          userId: user.id,
          name: aName,
          phone: profile?.phone ?? "",
          walletAddress,
        },
        file: {
          cid: fCid,
          url: fUrl,
          name: file.name,
          size: file.size,
          type: file.type,
        },
        ...(cCid
          ? {
              cover: {
                cid: cCid,
                url: cUrl,
                name: cover?.name,
                size: cover?.size,
                type: cover?.type,
              },
            }
          : {}),
        createdAt: new Date().toISOString(),
      },

      // ✅ cover riêng ưu tiên
      image: cUrl || fUrl,

      // ✅ file gốc để preview audio/video/pdf
      animation_url: fUrl,
    };

    const meta = await uploadJSONToIPFS(metadata);
    if (!meta.cid) throw new Error("Upload metadata lên IPFS thất bại.");

    // 4) mint hash bytes = sha256(metadataCid)
    const bytes32 = await cidToHashBytes32(meta.cid);
    if (bytes32.length !== 32) throw new Error("Hash bytes không đúng 32 bytes.");

    return {
      metadataCid: meta.cid,
      hashBytes32: bytes32,
      resolved: {
        fileCid: fCid,
        fileUrl: fUrl,
        coverCid: cCid || undefined,
        coverUrl: cUrl || undefined,
      },
    };
  }

  /* =======================
     ✅ step nav
  ======================= */
  function next() {
    if (step === 1) {
      if (!canGoStep1) {
        setErr(
          "Nhập tiêu đề (>=3 ký tự), chọn file, và kiểm tra ngày sáng tác (dd/mm/yyyy) trước khi tiếp tục."
        );
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  }
  function back() {
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  }

  /* =======================
     ✅ submit: offchain + onchain mint
  ======================= */
  async function onSubmit() {
    setErr(null);

    if (!configOk) {
      setErr(
        `Thiếu config on-chain cho "${activeNet}". Hãy điền đúng packageId + registryId trong chainstormConfig.ts`
      );
      return;
    }

    if (!canSubmit) {
      setErr(
        "Vui lòng kiểm tra: đăng nhập, kết nối ví, file/tiêu đề hợp lệ, ngày sáng tác đúng (dd/mm/yyyy)."
      );
      return;
    }

    setSubmitting(true);
    try {
      const { metadataCid, hashBytes32 } = await ensureIPFSReady();

      // 1) off-chain store
      const workId = addWork({
        title: title.trim(),
        authorId: user!.id,
        hash: metadataCid, // CID metadata
        category: category.trim() || undefined,
        language: language.trim() || undefined,
        createdDate: createdDate.trim() || undefined,
        sellType,
        royalty: royaltyNum,
        quorumWeight: 1,
      });

      // 2) on-chain mint (Move signature)
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::${MINT_FN}`,
        arguments: [
          tx.object(REGISTRY_ID),
          tx.pure.vector("u8", Array.from(hashBytes32)),
          tx.pure.u8(sellTypeU8),
          tx.pure.u8(royaltyNum),
        ],
      });

      const result = await signAndExecuteTransaction({
        transaction: tx,
        execute: { options: { showObjectChanges: true, showEffects: true } },
      });

      const digest = (result as any)?.digest as string | undefined;
      if (!digest) throw new Error("Không nhận được digest từ giao dịch.");

      // 3) read created WorkNFT id
      let createdObjectId: string | null = null;

      const changes = (result as any)?.objectChanges as any[] | undefined;
      if (Array.isArray(changes)) {
        const created = changes.find(
          (c) =>
            c?.type === "created" &&
            typeof c?.objectType === "string" &&
            c.objectType.includes(`${PACKAGE_ID}::${MODULE}::WorkNFT`) &&
            c?.objectId
        );
        createdObjectId = created?.objectId ?? null;

        if (!createdObjectId) {
          const anyCreated = changes.find(
            (c) => c?.type === "created" && c?.objectId
          );
          createdObjectId = anyCreated?.objectId ?? null;
        }
      }

      if (!createdObjectId) {
        const txb = await suiClient.getTransactionBlock({
          digest,
          options: { showObjectChanges: true, showEffects: true },
        });

        const oc = (txb as any)?.objectChanges as any[] | undefined;
        if (Array.isArray(oc)) {
          const created = oc.find(
            (c) =>
              c?.type === "created" &&
              typeof c?.objectType === "string" &&
              c.objectType.includes(`${PACKAGE_ID}::${MODULE}::WorkNFT`) &&
              c?.objectId
          );
          createdObjectId = created?.objectId ?? null;

          if (!createdObjectId) {
            const anyCreated = oc.find((c) => c?.type === "created" && c?.objectId);
            createdObjectId = anyCreated?.objectId ?? null;
          }
        }
      }

      if (!createdObjectId) {
        throw new Error("Mint thành công nhưng không đọc được objectId WorkNFT.");
      }

      // 4) bind
      bindNFTToWork({
        workId,
        nftObjectId: createdObjectId,
        packageId: PACKAGE_ID,
        txDigest: digest,
        authorWallet: walletAddress,
      });

      router.push("/manage");
    } catch (e: any) {
      const msg = String(e?.message || e);

      if (msg.includes("Package object does not exist")) {
        setErr(
          `PACKAGE_ID không tồn tại trên "${activeNet}". Kiểm tra Sui Wallet network + chainstormConfig.ts`
        );
      } else if (msg.includes("Object does not exist") && msg.includes(REGISTRY_ID)) {
        setErr(
          `REGISTRY_ID không tồn tại trên "${activeNet}". Bạn đã init_registry chưa? (registry phải là Shared object)`
        );
      } else if (msg.includes("100") || msg.toLowerCase().includes("duplicate")) {
        setErr("DUPLICATE_HASH (100): Hash bị trùng. Upload metadata mới hoặc đổi tác phẩm.");
      } else {
        setErr(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  /* ================= Render ================= */

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.warn}>
            <b>Chưa đăng nhập.</b>
            <div className={styles.warnText}>Vui lòng đăng nhập để đăng ký tác phẩm.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        {/* ===== Header ===== */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Đăng ký tác phẩm</h1>
            <p className={styles.subtitle}>
              Network: <b className={styles.net}>{activeNet}</b> • Module: <b>{MODULE}</b>
            </p>
          </div>

          <div className={styles.statusPill}>
            <span className={styles.dot} data-ok={!!walletAddress} />
            <div className={styles.statusText}>
              <div className={styles.statusTop}>
                <b>{authorName}</b>
                {authorPhone ? <span className={styles.muted}> • {authorPhone}</span> : null}
              </div>

              <div className={styles.mono}>
                {walletAddress ? shortAddr(walletAddress) : "Chưa kết nối ví"}
              </div>

              <div className={styles.monoSmall}>
                pkg: {PACKAGE_ID ? shortAddr(PACKAGE_ID) : "missing"} • reg:{" "}
                {REGISTRY_ID ? shortAddr(REGISTRY_ID) : "missing"}
              </div>
            </div>
            <div className={styles.stepBadge}>Step {step}/3</div>
          </div>
        </div>

        {!configOk ? (
          <div className={styles.warn}>
            <b>Thiếu config on-chain.</b>
            <div className={styles.warnText}>
              Điền <b>packageId</b> + <b>registryId</b> (Registry shared) trong{" "}
              <code>src/lib/chainstormConfig.ts</code>.
            </div>
          </div>
        ) : null}

        {err ? <div className={styles.error}>{err}</div> : null}

        {/* ===== Main Card ===== */}
        <div className={styles.card}>
          <div className={styles.cardTop}>
            <div className={styles.stepTitle}>
              {step === 1 && "Step 1 — File, cover & thông tin"}
              {step === 2 && "Step 2 — Bán / License"}
              {step === 3 && "Step 3 — Xác nhận & Mint"}
            </div>
            <div className={styles.progress}>
              <div className={styles.progressBar} style={{ width: `${(step / 3) * 100}%` }} />
            </div>
          </div>

          {step === 1 && (
            <div className={styles.grid}>
              <label className={styles.field}>
                <span className={styles.label}>Tiêu đề</span>
                <input
                  className={styles.input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Bản nhạc / Tranh / Ảnh..."
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Thể loại</span>
                <input
                  className={styles.input}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ví dụ: Music / Photo / Design..."
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Ngôn ngữ (tuỳ chọn)</span>
                <input
                  className={styles.input}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="vi / en / ja..."
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Ngày sáng tác (dd/mm/yyyy)</span>
                <input
                  className={styles.input}
                  value={createdDate}
                  onChange={(e) => setCreatedDate(e.target.value)}
                  placeholder="25/12/2025"
                />
                <span className={styles.help}>
                  {createdDate.trim()
                    ? createdDateOk
                      ? "✅ Hợp lệ"
                      : "❌ Sai định dạng hoặc ngày không hợp lệ"
                    : "Tuỳ chọn"}
                </span>
              </label>

              {/* FILE WORK */}
              <label className={styles.fieldFull}>
                <span className={styles.label}>File tác phẩm</span>
                <div className={styles.fileRow}>
                  <input
                    className={styles.file}
                    type="file"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setFile(f);

                      setFileCid("");
                      setFileUrl("");
                      setMetaCid("");
                      setMetaUrl("");
                      setUploadStage("idle");
                    }}
                  />

                  <button
                    type="button"
                    className={styles.btn}
                    disabled={!file || uploading || submitting || isPending}
                    onClick={async () => {
                      try {
                        setErr(null);
                        if (!file) return;
                        const r = await uploadFileToIPFS(file);
                        setFileCid(r.cid);
                        setFileUrl(r.url);
                      } catch (e: any) {
                        setErr(e?.message ?? "Upload thất bại.");
                      }
                    }}
                  >
                    {uploading && uploadStage === "upload_file"
                      ? "Đang upload..."
                      : "Upload IPFS"}
                  </button>
                </div>

                <div className={styles.ipfsInfo}>
                  <div className={styles.ipfsLine}>
                    <span className={styles.badge} data-ok={!!fileCid}>
                      File CID
                    </span>
                    <span className={styles.mono}>
                      {fileCid ? shortCid(fileCid) : "Chưa có"}
                    </span>
                    {fileUrl ? (
                      <a
                        className={styles.link}
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                    ) : null}
                  </div>
                  <div className={styles.ipfsHint}>
                    Mint sẽ pin metadata → lấy CID metadata → SHA-256 (32 bytes) → chống trùng hash.
                  </div>
                </div>
              </label>

              {/* COVER */}
              <label className={styles.fieldFull}>
                <span className={styles.label}>Ảnh cover (khuyến nghị)</span>
                <div className={styles.fileRow}>
                  <input
                    className={styles.file}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setCover(f);

                      setCoverCid("");
                      setCoverUrl("");
                      setMetaCid("");
                      setMetaUrl("");
                      setUploadStage("idle");
                    }}
                  />

                  <button
                    type="button"
                    className={styles.btn}
                    disabled={!cover || uploading || submitting || isPending}
                    onClick={async () => {
                      try {
                        setErr(null);
                        if (!cover) return;
                        const r = await uploadCoverToIPFS(cover);
                        setCoverCid(r.cid);
                        setCoverUrl(r.url);
                      } catch (e: any) {
                        setErr(e?.message ?? "Upload cover thất bại.");
                      }
                    }}
                  >
                    {uploading && uploadStage === "upload_cover"
                      ? "Đang upload..."
                      : "Upload cover"}
                  </button>
                </div>

                <div className={styles.ipfsInfo}>
                  <div className={styles.ipfsLine}>
                    <span className={styles.badge} data-ok={!!coverCid}>
                      Cover CID
                    </span>
                    <span className={styles.mono}>
                      {coverCid ? shortCid(coverCid) : "Chưa có"}
                    </span>
                    {coverUrl ? (
                      <a
                        className={styles.link}
                        href={coverUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                    ) : null}
                  </div>
                  <div className={styles.ipfsHint}>
                    Cover sẽ được set vào <b>metadata.image</b>. Nếu bỏ trống, hệ thống dùng file gốc làm ảnh.
                  </div>
                </div>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className={styles.grid}>
              <label className={styles.field}>
                <span className={styles.label}>Hình thức</span>
                <select
                  className={styles.input}
                  value={sellType}
                  onChange={(e) => setSellType(e.target.value as SellTypeUI)}
                >
                  <option value="exclusive">Bán đứt (exclusive)</option>
                  <option value="license">Bán license</option>
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Royalty (%)</span>
                <input
                  className={styles.input}
                  value={royalty}
                  onChange={(e) => setRoyalty(e.target.value)}
                  placeholder="Ví dụ: 5"
                />
                <span className={styles.help}>0–100% (lưu on-chain dạng u8)</span>
              </label>

              <div className={styles.reviewCard}>
                <div className={styles.reviewTitle}>🛡️ Quy trình duyệt</div>
                <div className={styles.reviewText}>
                  Tác phẩm sẽ vào trạng thái <b>pending</b> → đủ quorum thì <b>verified</b>.
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className={styles.summary}>
              <Row label="Network" value={activeNet} />
              <Row label="Package" value={PACKAGE_ID || "-"} mono />
              <Row label="Registry" value={REGISTRY_ID || "-"} mono />
              <Row label="Module" value={MODULE} />
              <Row label="Mint fn" value={MINT_FN} />
              <Row label="Tác giả" value={authorName} />
              <Row label="Ví" value={walletAddress ? shortAddr(walletAddress) : "-"} mono />
              <Row label="Tiêu đề" value={title || "-"} />
              <Row label="Thể loại" value={category || "-"} />
              <Row label="Ngôn ngữ" value={language || "-"} />
              <Row label="Ngày sáng tác" value={createdDate || "-"} />
              <Row label="SellType" value={`${sellType} (u8=${sellTypeU8})`} />
              <Row label="Royalty" value={`${royaltyNum}%`} />
              <Row label="File CID" value={fileCid ? shortCid(fileCid) : "Chưa có"} mono />
              <Row label="Cover CID" value={coverCid ? shortCid(coverCid) : "Chưa có"} mono />
              <Row label="Metadata CID" value={metaCid ? shortCid(metaCid) : "Sẽ tạo khi Mint"} mono />

              {metaUrl ? (
                <div className={styles.metaLinkRow}>
                  <a className={styles.link} href={metaUrl} target="_blank" rel="noreferrer">
                    Open metadata on gateway
                  </a>
                </div>
              ) : null}

              <div className={styles.callout}>
                Mint sẽ hash CID metadata (SHA-256) → <b>32 bytes</b> → Move để chống duplicate.
              </div>
            </div>
          )}

          {/* ===== Footer actions ===== */}
          <div className={styles.actions}>
            <button
              className={styles.btnGhost}
              onClick={back}
              disabled={step === 1 || submitting || isPending || uploading}
            >
              Quay lại
            </button>

            <div className={styles.actionsRight}>
              {step < 3 ? (
                <button
                  className={styles.btnPrimary}
                  onClick={next}
                  disabled={(step === 1 && !canGoStep1) || submitting || isPending || uploading}
                >
                  Tiếp theo
                </button>
              ) : (
                <button
                  className={styles.btnPrimary}
                  onClick={onSubmit}
                  disabled={!canSubmit || submitting || isPending || uploading}
                >
                  {submitting || isPending || uploading
                    ? uploadStage === "upload_file"
                      ? "Uploading file..."
                      : uploadStage === "upload_cover"
                      ? "Uploading cover..."
                      : uploadStage === "upload_meta"
                      ? "Uploading metadata..."
                      : "Đang mint..."
                    : "Mint"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={styles.footerNote}>
          Tip: Upload file + cover trước sẽ mint nhanh hơn (Step 3 không phải chờ upload).
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>{label}</div>
      <div className={mono ? styles.rowValueMono : styles.rowValue}>{value}</div>
    </div>
  );
}
