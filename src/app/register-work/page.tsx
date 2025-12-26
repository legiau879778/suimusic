// src/app/register-work/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./register-work.module.css";

import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  addWork,
  bindNFTToWork,
  getWorkByProofId,
  patchWorkByProofId,
} from "@/lib/workStore";
import { loadProfile, subscribeProfile, saveProfile } from "@/lib/profileStore";
import { signWorkProofMessage } from "@/lib/signWorkProofMessage";

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

type SellTypeUI = "exclusive" | "license" | "none";

type UploadStage = "idle" | "upload_file" | "upload_cover" | "upload_meta" | "done";

type UploadResult = {
  cid: string;
  url: string;
  name?: string;
  size?: number;
  type?: string;
};

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

async function readApi(res: Response) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const text = await res.text();

  if (!res.ok) {
    // 413 / 502 / html/text đều không làm crash
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (ct.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const MAX_MB = 4; // Vercel serverless thường ~4-5MB
function guardSize(f: File) {
  const mb = f.size / 1024 / 1024;
  if (mb > MAX_MB) {
    throw new Error(
      `File quá lớn (${mb.toFixed(1)}MB). Giới hạn upload qua server ~${MAX_MB}MB. ` +
        `Hãy dùng file nhỏ hơn hoặc chuyển sang direct upload.`
    );
  }
}

export default function RegisterWorkPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

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

  // audio/work file
  const [file, setFile] = useState<File | null>(null);
  const [fileDuration, setFileDuration] = useState<number | null>(null);

  // cover
  const [cover, setCover] = useState<File | null>(null);

  // upload
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [uploadPct, setUploadPct] = useState(0);

  // uploaded results
  const [fileBlobId, setFileBlobId] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  const [coverBlobId, setCoverBlobId] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  // metadata
  const [metaBlobId, setMetaBlobId] = useState("");
  const [metaUrl, setMetaUrl] = useState("");

  const [proofId, setProofId] = useState("");
  const [proofStatus, setProofStatus] = useState<
    "draft" | "submitted" | "tsa_attested" | "approved" | "rejected"
  >("draft");

  // author snapshot
  const [authorName, setAuthorName] = useState<string>("Unknown");
  const [authorPhone, setAuthorPhone] = useState<string>("");

  // ✅ email + avatar snapshot
  const [authorEmail, setAuthorEmail] = useState<string>("");
  const [authorAvatar, setAuthorAvatar] = useState<string>("");

  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* =======================
     ✅ profileStore sync
  ======================= */
  useEffect(() => {
    if (!user?.id) return;

    const apply = () => {
      const p = loadProfile(user.id);

      const name = p?.name?.trim() ? p.name.trim() : "Unknown";
      const phone = p?.phone ?? "";

      const email = String(p?.email || user.email || "").trim();
      const avatar = String((p as any)?.avatar || (user as any)?.avatar || "").trim();

      setAuthorName(name);
      setAuthorPhone(phone);
      setAuthorEmail(email);
      setAuthorAvatar(avatar);
    };

    apply();
    const unsub = subscribeProfile(user.id, () => apply());
    return unsub;
  }, [user?.id, user?.email, (user as any)?.avatar]);

  /* =======================
     ✅ helpers: progress UI
  ======================= */
  function stageLabel(s: UploadStage) {
    switch (s) {
      case "upload_file":
        return "Uploading audio/file…";
      case "upload_cover":
        return "Uploading cover…";
      case "upload_meta":
        return "Uploading metadata…";
      case "done":
        return "Done";
      default:
        return "Idle";
    }
  }

  // fetch() không có upload progress chuẩn, dùng stage-progress giả lập cho UX
  function startFakeProgress(stage: UploadStage) {
    setUploadStage(stage);
    setUploadPct(2);

    let pct = 2;
    const cap = stage === "upload_file" ? 88 : stage === "upload_cover" ? 92 : 96;

    const id = window.setInterval(() => {
      const step = pct < 30 ? 6 : pct < 60 ? 4 : pct < 80 ? 2 : 1;
      pct = Math.min(cap, pct + step);
      setUploadPct(pct);
    }, 250);

    return () => window.clearInterval(id);
  }

  function finishProgress() {
    setUploadPct(100);
    window.setTimeout(() => setUploadPct(0), 450);
  }

  function resetWalrusState() {
    setErr(null);
    setFileBlobId("");
    setFileUrl("");
    setCoverBlobId("");
    setCoverUrl("");
    setMetaBlobId("");
    setMetaUrl("");
    setUploadStage("idle");
    setUploadPct(0);
    setProofId("");
  }

  /* =======================
     ✅ computed
  ======================= */
  const royaltyNum = useMemo(() => {
    const n = Number(royalty);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.floor(n)));
  }, [royalty]);

  const sellTypeU8 = useMemo(() => {
    if (sellType === "exclusive") return 1;
    if (sellType === "license") return 2;
    return 0;
  }, [sellType]);

  const configOk = useMemo(() => {
    return Boolean(
      PACKAGE_ID?.startsWith("0x") && REGISTRY_ID?.startsWith("0x") && MODULE && MINT_FN
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
  }, [configOk, user?.id, walletAddress, title, file, createdDateOk, uploading, isPending]);

  useEffect(() => setErr(null), [step, sellType, activeNet]);

  async function refreshProofStatus() {
    if (step !== 3 || !proofId) return;
    try {
      showToast("Đang làm mới trạng thái hồ sơ...", "info");
      const res = await fetch(`/api/proof/${encodeURIComponent(proofId)}`);
      const data: any = await readApi(res);
      if (data?.ok && data?.proof?.status) {
        setProofStatus(data.proof.status);
        showToast("Đã cập nhật trạng thái hồ sơ.", "success");
      }
    } catch {
      // keep current status
      showToast("Không thể refresh trạng thái hồ sơ.", "error");
    }
  }


  function shortCid(cid: string) {
    return cid ? `${cid.slice(0, 10)}…${cid.slice(-6)}` : "";
  }
  function shortAddr(addr: string) {
    return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
  }

  function isImageMime(mime?: string) {
    return !!mime && mime.startsWith("image/");
  }

  function isMediaFile(f: File) {
    const t = String(f?.type || "");
    if (t.startsWith("audio/") || t.startsWith("video/")) return true;
    const name = String(f?.name || "").toLowerCase();
    return /\.(mp3|wav|ogg|m4a|flac|mp4|webm|mov|mkv)$/.test(name);
  }

  async function readMediaDuration(f: File): Promise<number | null> {
    if (!f || !isMediaFile(f)) return null;

    const url = URL.createObjectURL(f);
    const media =
      String(f?.type || "").startsWith("video/")
        ? document.createElement("video")
        : document.createElement("audio");

    return new Promise((resolve) => {
      const cleanup = () => {
        URL.revokeObjectURL(url);
        media.src = "";
      };

      media.preload = "metadata";
      media.onloadedmetadata = () => {
        const d = Number.isFinite(media.duration) ? media.duration : NaN;
        cleanup();
        resolve(Number.isFinite(d) && d > 0 ? Math.floor(d) : null);
      };
      media.onerror = () => {
        cleanup();
        resolve(null);
      };
      media.src = url;
    });
  }

  /* =======================
     ✅ Walrus upload helpers
     - POST /api/walrus/upload-file (FormData: file)
     - POST /api/walrus/upload-json (JSON)
  ======================= */
  async function uploadToWalrusFile(
    f: File,
    kind: "audio" | "cover"
  ): Promise<UploadResult> {
    setUploading(true);
    setUploadStage(kind === "audio" ? "upload_file" : "upload_cover");
    setUploadPct(0);

    try {
      showToast(
        kind === "audio" ? "Đang upload file lên Walrus..." : "Đang upload cover lên Walrus...",
        "info"
      );
      const fd = new FormData();
      fd.append("file", f, f.name);
      fd.append("kind", kind);

      const result = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/walrus/upload-file", true);

        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploadPct(pct);
        };

        xhr.onload = () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            return reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
          }
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error("Invalid Walrus response"));
          }
        };

        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(fd);
      });

      if (!result?.ok) throw new Error(result?.error || "Upload failed");
      const blobId = result?.blobId as string;
      if (!blobId) throw new Error("Walrus response missing blobId");

      setUploadStage("done");
      setTimeout(() => setUploadPct(0), 800);
      showToast("Upload Walrus thành công.", "success");

      return {
        cid: blobId,
        url: result?.url || "",
        name: f.name,
        size: f.size,
        type: f.type,
      };
    } catch (e: any) {
      showToast(e?.message || "Upload thất bại.", "error");
      throw e;
    } finally {
      setUploading(false);
    }
  }


  async function uploadJSONToWalrus(json: any): Promise<{ blobId: string; url: string }> {
    setUploading(true);
    const stop = startFakeProgress("upload_meta");

    try {
      showToast("Đang upload metadata lên Walrus...", "info");
      const res = await fetch("/api/walrus/upload-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });

      const data: any = await readApi(res);
      if (!data?.ok) throw new Error(data?.error || "Upload metadata failed");

      setMetaBlobId(data.blobId);
      setMetaUrl(data.url);
      setUploadStage("done");
      finishProgress();
      showToast("Upload metadata thành công.", "success");

      return { blobId: data.blobId, url: data.url };
    } catch (e: any) {
      showToast(e?.message || "Upload metadata thất bại.", "error");
      throw e;
    } finally {
      stop?.();
      setUploading(false);
    }
  }

  async function sha256Bytes(input: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
    const view = input instanceof Uint8Array ? input : new Uint8Array(input);
    const buf = view.slice().buffer;
    const hash = await crypto.subtle.digest("SHA-256", buf as ArrayBuffer);
    return new Uint8Array(hash);
  }

  function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function strToBytes(s: string): Uint8Array {
    return new TextEncoder().encode(s);
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
    if (created?.objectId) return created.objectId as string;

    const anyCreated = changes.find((c) => c?.type === "created" && c?.objectId);
    return anyCreated?.objectId ?? null;
  }

  async function ensureWalrusReady(): Promise<{
    metadataBlobId: string;
    fileHashBytes32: Uint8Array;
    metaHashBytes32: Uint8Array;
    fileHashHex: string;
    metaHashHex: string;
    metadataJson: any;
    durationSec?: number;
    resolved: {
      fileBlobId: string;
      fileUrl: string;
      coverBlobId?: string;
      coverUrl?: string;
    };
  }> {
    if (!user?.id) throw new Error("Bạn cần đăng nhập.");
    if (!file) throw new Error("Bạn chưa chọn file tác phẩm.");

    // 1) hash file
    const fileBuf = await file.arrayBuffer();
    const fileHashBytes = await sha256Bytes(fileBuf);
    const fileHashHex = bytesToHex(fileHashBytes);

    // 2) ensure main file (audio)
    let fBlobId = fileBlobId;
    let fUrl = fileUrl;

    if (!fBlobId) {
      const r = await uploadToWalrusFile(file, "audio");
      fBlobId = r.cid;
      fUrl = r.url;
      setFileBlobId(r.cid);
      setFileUrl(r.url);
    }
    if (!fBlobId) throw new Error("Upload file lên Walrus thất bại.");

    // 3) ensure cover (optional)
    let cBlobId = coverBlobId;
    let cUrl = coverUrl;

    if (cover && !cBlobId) {
      const r = await uploadToWalrusFile(cover, "cover");
      cBlobId = r.cid;
      cUrl = r.url;
      setCoverBlobId(r.cid);
      setCoverUrl(r.url);
    }

    // 4) metadata JSON
    const profile = loadProfile(user.id);
    const aName = profile?.name?.trim() ? profile.name.trim() : "Unknown";

    const createdISO = createdDate.trim()
      ? parseDDMMYYYYToISO(createdDate.trim())
      : null;

    if (createdDate.trim() && !createdISO) {
      throw new Error("Ngày sáng tác không hợp lệ. Định dạng đúng: dd/mm/yyyy");
    }

    const safeTitle = title.trim();
    const topImage = cUrl || (isImageMime(file.type) ? fUrl : "");

    const effectiveDuration =
      fileDuration != null ? fileDuration : await readMediaDuration(file);
    if (fileDuration == null && effectiveDuration != null) {
      setFileDuration(effectiveDuration);
    }

    const metadata: any = {
      name: safeTitle,
      description: "Chainstorm WorkNFT metadata (Walrus)",

      ...(topImage ? { image: topImage } : {}),
      animation_url: fUrl,
      ...(effectiveDuration != null ? { duration: effectiveDuration } : {}),

        file: {
          walrusId: fBlobId,
          url: fUrl,
          mime: file.type || "",
          name: file.name,
          size: file.size,
          sha256: fileHashHex,
          ...(effectiveDuration != null ? { duration: effectiveDuration } : {}),
        },

      ...(cUrl
        ? {
            cover_image: cUrl,
            cover: {
              walrusId: cBlobId,
              url: cUrl,
              mime: cover?.type || "image/*",
              name: cover?.name,
              size: cover?.size,
            },
          }
        : {}),

      attributes: [
        { trait_type: "sellType", value: sellType },
        { trait_type: "sell_type_u8", value: sellTypeU8 },
        { trait_type: "royalty_percent", value: royaltyNum },
        ...(category.trim() ? [{ trait_type: "category", value: category.trim() }] : []),
        ...(language.trim() ? [{ trait_type: "language", value: language.trim() }] : []),
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
          email: String(profile?.email || user.email || "").trim(),
          avatar: String((profile as any)?.avatar || (user as any)?.avatar || "").trim(),
          phone: profile?.phone ?? "",
          walletAddress,
        },

        file: {
          walrusId: fBlobId,
          url: fUrl,
          name: file.name,
          size: file.size,
          type: file.type,
          sha256: fileHashHex,
        },
        ...(cBlobId
          ? {
              cover: {
                walrusId: cBlobId,
                url: cUrl,
                name: cover?.name,
                size: cover?.size,
                type: cover?.type,
              },
            }
          : {}),
        createdAt: new Date().toISOString(),
        ...(effectiveDuration != null ? { duration: effectiveDuration } : {}),
      },
    };

    const metaStr = JSON.stringify(metadata);
    const metaBytes = strToBytes(metaStr);
    const metaHashBytes = await sha256Bytes(metaBytes);
    const metaHashHex = bytesToHex(metaHashBytes);

    const meta = await uploadJSONToWalrus(metadata);
    if (!meta.blobId) throw new Error("Upload metadata lên Walrus thất bại.");

    if (fileHashBytes.length !== 32 || metaHashBytes.length !== 32) {
      throw new Error("Hash bytes không đúng 32 bytes.");
    }

    return {
      metadataBlobId: meta.blobId,
      fileHashBytes32: fileHashBytes,
      metaHashBytes32: metaHashBytes,
      fileHashHex,
      metaHashHex,
      metadataJson: metadata,
      durationSec: effectiveDuration ?? undefined,
      resolved: {
        fileBlobId: fBlobId,
        fileUrl: fUrl,
        coverBlobId: cBlobId || undefined,
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
        showToast(
          "Thiếu thông tin ở Step 1. Kiểm tra tiêu đề/file/ngày sáng tác.",
          "warning"
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
     ✅ submit: offchain proof only
  ======================= */
  async function submitProof() {
    setErr(null);

      if (!configOk) {
        setErr(
          `Thiếu config on-chain cho "${activeNet}". Hãy điền đúng packageId + registryId trong chainstormConfig.ts`
        );
        showToast("Thiếu config on-chain. Kiểm tra chainstormConfig.ts", "error");
        return null;
      }

      if (!canSubmit) {
        setErr(
          "Vui lòng kiểm tra: đăng nhập, kết nối ví, file/tiêu đề hợp lệ, ngày sáng tác đúng (dd/mm/yyyy)."
        );
        showToast("Thiếu điều kiện nộp hồ sơ.", "warning");
        return null;
      }

    setSubmitting(true);
    try {
      const {
        metadataBlobId,
        fileHashBytes32,
        metaHashBytes32,
        fileHashHex,
        metaHashHex,
        metadataJson,
        durationSec,
        resolved,
      } = await ensureWalrusReady();

      const proofMessage = `
CHAINSTORM WORK PROOF
Wallet: ${walletAddress}
FileHash: ${fileHashHex}
MetaHash: ${metaHashHex}
WalrusFileId: ${resolved.fileBlobId}
WalrusMetaId: ${metadataBlobId}
Time: ${new Date().toISOString()}
`.trim();

      const { signature: authorSignature, walletAddress: signedWallet } =
        await signWorkProofMessage(proofMessage);

      if (
        walletAddress &&
        signedWallet &&
        walletAddress.toLowerCase() !== signedWallet.toLowerCase()
      ) {
        throw new Error("Ví ký không khớp với ví đang kết nối.");
      }

      const proofRes = await fetch("/api/proof/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorId: user!.id,
          wallet: walletAddress,
          fileHash: fileHashHex,
          metaHash: metaHashHex,
          walrusFileId: resolved.fileBlobId,
          walrusMetaId: metadataBlobId,
          walrusCoverId: resolved.coverBlobId,
          message: proofMessage,
          authorSignature,
          metadata: metadataJson,
        }),
      });

      const proofData: any = await readApi(proofRes);
      if (!proofData?.ok) {
        throw new Error(proofData?.error || "Nộp hồ sơ pháp lý thất bại.");
      }

      const proof = proofData?.proof;
      setProofId(proof?.id || "");
      setProofStatus(proof?.status || "submitted");
      showToast("Đã nộp hồ sơ. Chờ admin duyệt.", "success");

      const existing = getWorkByProofId(proof?.id);
      if (existing) {
        patchWorkByProofId(proof?.id, {
          hash: `walrus:${metadataBlobId}`,
          fileHash: fileHashHex,
          metaHash: metaHashHex,
          walrusFileId: resolved.fileBlobId,
          walrusMetaId: metadataBlobId,
          walrusCoverId: resolved.coverBlobId,
          durationSec,
          authorSignature,
          tsaId: proof.tsa?.id,
          tsaSignature: proof.tsa?.signature,
          tsaTime: proof.tsa?.time,
          approvalSignature: proof.approval?.signature,
          approvalWallet: proof.approval?.adminWallet,
          approvalTime: proof.approval?.time,
        });
      } else {
        addWork({
          title: title.trim(),
          authorId: user!.id,

          authorName: authorName || user!.id,
          authorEmail: authorEmail || String(user?.email || ""),
          authorAvatar: authorAvatar || String((user as any)?.avatar || ""),
          authorPhone: authorPhone || "",
          authorWallet: walletAddress || "",

          hash: `walrus:${metadataBlobId}`,
          fileHash: fileHashHex,
          metaHash: metaHashHex,
          walrusFileId: resolved.fileBlobId,
          walrusMetaId: metadataBlobId,
          walrusCoverId: resolved.coverBlobId,
          durationSec,
          proofId: proof.id,
          authorSignature,
          tsaId: proof.tsa?.id,
          tsaSignature: proof.tsa?.signature,
          tsaTime: proof.tsa?.time,
          approvalSignature: proof.approval?.signature,
          approvalWallet: proof.approval?.adminWallet,
          approvalTime: proof.approval?.time,
          category: category.trim() || undefined,
          language: language.trim() || undefined,
          createdDate: createdDate.trim() || undefined,
          sellType,
          royalty: royaltyNum,
          quorumWeight: 1,
        });
      }

      return {
        proof,
        metadataBlobId,
        fileHashBytes32,
        metaHashBytes32,
        resolved,
        durationSec,
        authorSignature,
      };
    } catch (e: any) {
      const msg = String(e?.message || e);
      setErr(msg);
      showToast(msg, "error");
      return null;
    } finally {
      setSubmitting(false);
    }
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
        showToast("Thiếu config on-chain. Kiểm tra chainstormConfig.ts", "error");
        return;
      }

      if (!canSubmit) {
        setErr(
          "Vui lòng kiểm tra: đăng nhập, kết nối ví, file/tiêu đề hợp lệ, ngày sáng tác đúng (dd/mm/yyyy)."
        );
        showToast("Thiếu điều kiện mint.", "warning");
        return;
      }

    setSubmitting(true);
    try {
      let proof: any = null;
      let metadataBlobId = "";
      let fileHashBytes32: Uint8Array | null = null;
      let metaHashBytes32: Uint8Array | null = null;
      let resolved: any = null;
      let authorSignature = "";
      let durationSecFromProof: number | undefined;

      if (proofId) {
        const res = await fetch(`/api/proof/${encodeURIComponent(proofId)}`);
        const data: any = await readApi(res);
        if (!data?.ok) {
          throw new Error(data?.error || "Không lấy được hồ sơ pháp lý.");
        }
        proof = data?.proof;
        setProofStatus(proof?.status || "submitted");
        if (!proof?.approval || proof?.status !== "approved") {
          setErr("Hồ sơ đã nộp. Hãy chờ admin duyệt trước khi mint.");
          showToast("Hồ sơ chưa được duyệt.", "warning");
          return;
        }
        metadataBlobId = String(proof?.walrusMetaId || "").trim();
        resolved = {
          fileBlobId: String(proof?.walrusFileId || "").trim(),
          coverBlobId: String(proof?.walrusCoverId || "").trim() || undefined,
        };
        authorSignature = String(proof?.authorSignature || "").trim();
        const rawDuration =
          proof?.metadata?.duration ??
          proof?.metadata?.properties?.duration ??
          proof?.metadata?.properties?.file?.duration;
        const numDur = Number(rawDuration);
        durationSecFromProof =
          Number.isFinite(numDur) && numDur > 0 ? Math.floor(numDur) : undefined;
        fileHashBytes32 = new Uint8Array(
          String(proof?.fileHash || "")
            .match(/.{1,2}/g)
            ?.map((b: string) => parseInt(b, 16)) || []
        );
        metaHashBytes32 = new Uint8Array(
          String(proof?.metaHash || "")
            .match(/.{1,2}/g)
            ?.map((b: string) => parseInt(b, 16)) || []
        );
      } else {
        const submitted = await submitProof();
        if (!submitted?.proof) {
          return;
        }
        proof = submitted.proof;
        setProofStatus(proof?.status || "submitted");
        if (!proof?.approval || proof?.status !== "approved") {
          setErr("Hồ sơ đã nộp. Hãy chờ admin duyệt trước khi mint.");
          showToast("Hồ sơ chưa được duyệt.", "warning");
          return;
        }
        metadataBlobId = submitted.metadataBlobId;
        fileHashBytes32 = submitted.fileHashBytes32;
        metaHashBytes32 = submitted.metaHashBytes32;
        resolved = submitted.resolved;
        authorSignature = submitted.authorSignature;
        durationSecFromProof = submitted.durationSec;
      }

      if (!fileHashBytes32 || !metaHashBytes32) {
        throw new Error("Thiếu hash để mint. Vui lòng nộp hồ sơ lại.");
      }

      // ✅ đảm bảo profileStore có email/avatar (nếu Auth có mà profileStore chưa có)
      try {
        const current: any = loadProfile(user!.id);
        const patch: any = {};

        const e = String(current?.email || "").trim();
        const a = String(current?.avatar || "").trim();

        const authEmail = String(user?.email || "").trim();
        const authAvatar = String((user as any)?.avatar || "").trim();

        if (!e && authEmail) patch.email = authEmail;
        if (!a && authAvatar) patch.avatar = authAvatar;

        if (Object.keys(patch).length) saveProfile(user!.id, patch);
      } catch {}

      // 1) off-chain store
      const existing = getWorkByProofId(proof.id);
      const workId =
        existing?.id ||
        addWork({
          title: title.trim(),
          authorId: user!.id,

          authorName: authorName || user!.id,
          authorEmail: authorEmail || String(user?.email || ""),
          authorAvatar: authorAvatar || String((user as any)?.avatar || ""),
          authorPhone: authorPhone || "",
          authorWallet: walletAddress || "",

          hash: `walrus:${metadataBlobId}`, // Walrus metadata blob
          fileHash: proof.fileHash,
          metaHash: proof.metaHash,
          walrusFileId: resolved.fileBlobId,
          walrusMetaId: metadataBlobId,
          walrusCoverId: resolved.coverBlobId,
          durationSec: durationSecFromProof,
          proofId: proof.id,
          authorSignature,
          tsaId: proof.tsa?.id,
          tsaSignature: proof.tsa?.signature,
          tsaTime: proof.tsa?.time,
          approvalSignature: proof.approval?.signature,
          approvalWallet: proof.approval?.adminWallet,
          approvalTime: proof.approval?.time,
          category: category.trim() || undefined,
          language: language.trim() || undefined,
          createdDate: createdDate.trim() || undefined,
          sellType,
          royalty: royaltyNum,
          quorumWeight: 1,
        });

      // 2) on-chain mint (Move signature)
      const tsaMillis = Date.parse(String(proof.tsa?.time || ""));
      const tsaTime = Number.isFinite(tsaMillis) ? Math.floor(tsaMillis / 1000) : 0;

      const authorSigBytes = strToBytes(authorSignature);
      const tsaIdBytes = strToBytes(String(proof.tsa?.id || ""));
      const tsaSigBytes = strToBytes(String(proof.tsa?.signature || ""));
      const approvalSigBytes = strToBytes(String(proof.approval?.signature || ""));
      const proofIdBytes = strToBytes(String(proof.id || ""));
      const walrusFileIdBytes = strToBytes(String(resolved.fileBlobId || ""));
      const walrusMetaIdBytes = strToBytes(String(metadataBlobId || ""));

      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::${MINT_FN}`,
        arguments: [
          tx.object(REGISTRY_ID),
          tx.pure.vector("u8", Array.from(fileHashBytes32)),
          tx.pure.vector("u8", Array.from(metaHashBytes32)),
          tx.pure.vector("u8", Array.from(walrusFileIdBytes)),
          tx.pure.vector("u8", Array.from(walrusMetaIdBytes)),
          tx.pure.vector("u8", Array.from(authorSigBytes)),
          tx.pure.vector("u8", Array.from(tsaIdBytes)),
          tx.pure.vector("u8", Array.from(tsaSigBytes)),
          tx.pure.u64(tsaTime),
          tx.pure.vector("u8", Array.from(approvalSigBytes)),
          tx.pure.vector("u8", Array.from(proofIdBytes)),
          tx.pure.u8(sellTypeU8),
          tx.pure.u8(royaltyNum),
        ],
      });

      const result = await signAndExecuteTransaction({ transaction: tx });

      const digest = (result as any)?.digest as string | undefined;
      if (!digest) throw new Error("Không nhận được digest từ giao dịch.");

      // 3) read created WorkNFT id
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
        throw new Error(
          "Mint thành công nhưng không đọc được objectId WorkNFT. Hãy mở lại giao dịch và thử lại."
        );
      }

      // 4) bind
      bindNFTToWork({
        workId,
        nftObjectId: createdObjectId,
        packageId: PACKAGE_ID,
        txDigest: digest,
        authorWallet: walletAddress,
      });

      showToast("Mint thành công.", "success");
      router.push("/manage");
    } catch (e: any) {
      const msg = String(e?.message || e);

      if (msg.includes("Package object does not exist")) {
        setErr(
          `PACKAGE_ID không tồn tại trên "${activeNet}". Kiểm tra Sui Wallet network + chainstormConfig.ts`
        );
        showToast("PACKAGE_ID không tồn tại trên network.", "error");
      } else if (msg.includes("Object does not exist") && msg.includes(REGISTRY_ID)) {
        setErr(
          `REGISTRY_ID không tồn tại trên "${activeNet}". Bạn đã init_registry chưa? (registry phải là Shared object)`
        );
        showToast("REGISTRY_ID không tồn tại trên network.", "error");
      } else if (msg.includes("100") || msg.toLowerCase().includes("duplicate")) {
        setErr("DUPLICATE_HASH (100): Hash bị trùng. Upload metadata mới hoặc đổi tác phẩm.");
        showToast("Hash bị trùng. Hãy đổi tác phẩm.", "error");
      } else {
        setErr(msg);
        showToast(msg, "error");
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

        {/* ✅ upload progress */}
        {uploading ? (
          <div className={styles.uploadBarWrap}>
            <div className={styles.uploadBarTop}>
              <span className={styles.uploadStage}>{stageLabel(uploadStage)}</span>
              <span className={styles.uploadPct}>{uploadPct}%</span>
            </div>
            <div className={styles.uploadTrack}>
              <div className={styles.uploadFill} style={{ width: `${uploadPct}%` }} />
            </div>
          </div>
        ) : null}

        {/* ===== Main Card ===== */}
        <div className={styles.card}>
          <div className={styles.cardTop}>
            <div className={styles.stepTitle}>
              {step === 1 && "Step 1 — Audio/file, cover & thông tin"}
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

              {/* AUDIO/FILE WORK */}
              <label className={styles.fieldFull}>
                <span className={styles.label}>Audio / File tác phẩm</span>
                <div className={styles.fileRow}>
                  <input
                    className={styles.file}
                    type="file"
                    accept="audio/*,video/*,application/pdf,image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setFile(f);
                      setFileDuration(null);
                      resetWalrusState();
                      if (f) {
                        readMediaDuration(f).then((d) => {
                          if (d != null) setFileDuration(d);
                        });
                      }
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
                        const r = await uploadToWalrusFile(file, "audio");
                        setFileBlobId(r.cid);
                        setFileUrl(r.url);
                      } catch (e: any) {
                        setErr(e?.message ?? "Upload thất bại.");
                      }
                    }}
                  >
                    {uploading && uploadStage === "upload_file" ? "Đang upload..." : "Upload Walrus"}
                  </button>
                </div>

                <div className={styles.ipfsInfo}>
                  <div className={styles.ipfsLine}>
                    <span className={styles.badge} data-ok={!!fileBlobId}>
                      File Blob ID
                    </span>
                    <span className={styles.mono}>
                      {fileBlobId ? shortCid(fileBlobId) : "Chưa có"}
                    </span>
                    {fileUrl ? (
                      <a className={styles.link} href={fileUrl} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : null}
                  </div>
                  <div className={styles.ipfsHint}>
                    Mint sẽ hash file + metadata → 32 bytes → chống trùng hash.
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

                      if (f && !f.type.startsWith("image/")) {
                        setErr("Cover phải là ảnh (image/*).");
                        e.currentTarget.value = "";
                        return;
                      }

                      setCover(f);
                      // chỉ reset cover/meta (giữ file nếu có)
                      setErr(null);
                      setCoverBlobId("");
                      setCoverUrl("");
                      setMetaBlobId("");
                      setMetaUrl("");
                      setUploadStage("idle");
                      setUploadPct(0);
                      setProofId("");
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
                        const r = await uploadToWalrusFile(cover, "cover");
                        setCoverBlobId(r.cid);
                        setCoverUrl(r.url);
                      } catch (e: any) {
                        setErr(e?.message ?? "Upload cover thất bại.");
                      }
                    }}
                  >
                    {uploading && uploadStage === "upload_cover" ? "Đang upload..." : "Upload cover"}
                  </button>
                </div>

                <div className={styles.ipfsInfo}>
                  <div className={styles.ipfsLine}>
                    <span className={styles.badge} data-ok={!!coverBlobId}>
                      Cover Blob ID
                    </span>
                    <span className={styles.mono}>
                      {coverBlobId ? shortCid(coverBlobId) : "Chưa có"}
                    </span>
                    {coverUrl ? (
                      <a className={styles.link} href={coverUrl} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : null}
                  </div>
                  <div className={styles.ipfsHint}>
                    Cover sẽ được set vào <b>metadata.image</b>. Nếu bỏ trống và file là ảnh thì
                    dùng file làm image; còn không thì card có thể không có cover.
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
                  <option value="none">Không bán</option>
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
              <Row label="Email" value={authorEmail || user?.email || "-"} />
              <Row label="Ví" value={walletAddress ? shortAddr(walletAddress) : "-"} mono />
              <Row label="Tiêu đề" value={title || "-"} />
              <Row label="Thể loại" value={category || "-"} />
              <Row label="Ngôn ngữ" value={language || "-"} />
              <Row label="Ngày sáng tác" value={createdDate || "-"} />
              <Row label="SellType" value={`${sellType} (u8=${sellTypeU8})`} />
              <Row label="Royalty" value={`${royaltyNum}%`} />
              <Row label="File Blob ID" value={fileBlobId ? shortCid(fileBlobId) : "Chưa có"} mono />
              <Row label="Cover Blob ID" value={coverBlobId ? shortCid(coverBlobId) : "Chưa có"} mono />
              <Row
                label="Metadata Blob ID"
                value={metaBlobId ? shortCid(metaBlobId) : "Sẽ tạo khi Mint"}
                mono
              />
              <Row label="Proof ID" value={proofId || "Chưa có"} mono />
              <Row
                label="Proof status"
                value={proofStatus === "draft" ? "Chưa nộp" : proofStatus}
              />
              <div className={styles.metaLinkRow}>
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={refreshProofStatus}
                  disabled={!proofId || submitting || isPending || uploading}
                  title="Lấy trạng thái mới nhất"
                >
                  Refresh status
                </button>
              </div>

              {proofStatus !== "approved" ? (
                <div className={styles.callout}>
                  Hồ sơ cần được admin duyệt trước khi mint. Vào trang{" "}
                  <b>/admin/review</b> để duyệt.
                </div>
              ) : null}


              {metaUrl ? (
                <div className={styles.metaLinkRow}>
                  <a className={styles.link} href={metaUrl} target="_blank" rel="noreferrer">
                    Open metadata on gateway
                  </a>
                </div>
              ) : null}

              <div className={styles.callout}>
                Mint sẽ hash <b>file + metadata</b> (SHA-256) → <b>32 bytes</b> → Move để chống
                duplicate.
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
                <>
                  <button
                    className={styles.btnGhost}
                    onClick={submitProof}
                    disabled={!canSubmit || submitting || isPending || uploading}
                    title="Nộp hồ sơ pháp lý (off-chain)"
                  >
                    Nộp hồ sơ
                  </button>
                  <button
                    className={styles.btnPrimary}
                    onClick={onSubmit}
                    disabled={
                      !canSubmit ||
                      proofStatus !== "approved" ||
                      submitting ||
                      isPending ||
                      uploading
                    }
                    title={
                      proofStatus !== "approved"
                        ? "Hồ sơ chưa được duyệt"
                        : "Mint on-chain"
                    }
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
                </>
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
