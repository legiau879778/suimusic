// src/app/register-work/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./register-work.module.css";

import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  addWork,
  bindNFTToWork,
  getWorkByProofId,
  patchWorkByProofId,
  syncWorksFromChain,
} from "@/lib/workStore";
import { loadProfile, subscribeProfile, saveProfile } from "@/lib/profileStore";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
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
type UsageRightsUI = "standard" | "ai";

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
    // 413 / 502 / html/text will not crash
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

const MAX_MB = 4; // Vercel serverless is usually ~4-5MB
const DIRECT_WALRUS_ENDPOINT = process.env.NEXT_PUBLIC_WALRUS_ENDPOINT || "";
const DIRECT_WALRUS_EPOCHS = process.env.NEXT_PUBLIC_WALRUS_STORE_EPOCHS || "";
const DIRECT_WALRUS_API_KEY = process.env.NEXT_PUBLIC_WALRUS_API_KEY || "";
const CAN_DIRECT_UPLOAD = Boolean(DIRECT_WALRUS_ENDPOINT);

function appendQuery(url: string, key: string, value: string) {
  if (!value) return url;
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function buildUploadCandidates(endpoint: string, epochs?: string) {
  const base = endpoint.replace(/\/+$/, "");
  const list = [endpoint];
  if (!base.includes("/v1/") && !base.endsWith("/store")) {
    list.push(`${base}/v1/store`, `${base}/store`);
  }
  const withQuery = list.map((u) => appendQuery(u, "epochs", epochs || ""));
  return Array.from(new Set(withQuery));
}

function pickBlobId(data: any) {
  return (
    data?.blobId ||
    data?.id ||
    data?.blob_id ||
    data?.objectId ||
    data?.object_id ||
    null
  );
}

function pickUrl(data: any) {
  return data?.url || data?.uri || data?.blobUrl || null;
}

function isOverServerLimit(f: File) {
  return f.size > MAX_MB * 1024 * 1024;
}

function guardSize(f: File) {
  const mb = f.size / 1024 / 1024;
  if (mb > MAX_MB) {
    throw new Error(
      `File is too large (${mb.toFixed(1)}MB). Server upload limit is ~${MAX_MB}MB. ` +
        `Use a smaller file or switch to direct upload.`
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
  const [customGenre, setCustomGenre] = useState("");
  const [language, setLanguage] = useState("");
  const [createdDate, setCreatedDate] = useState(""); // dd/mm/yyyy

  const [sellType, setSellType] = useState<SellTypeUI>("exclusive");
  const [usageRights, setUsageRights] = useState<UsageRightsUI>("standard");
  const [royalty, setRoyalty] = useState<string>("5");
  const [exclusivePrice, setExclusivePrice] = useState<string>("1");
  const [licensePrice, setLicensePrice] = useState<string>("0.1");
  const [termsAccepted, setTermsAccepted] = useState(false);

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
  const [metaHashHexState, setMetaHashHexState] = useState("");

  const [proofId, setProofId] = useState("");
  const [proofStatus, setProofStatus] = useState<
    "draft" | "submitted" | "tsa_attested" | "approved" | "rejected"
  >("draft");
  const [proofRealtime, setProofRealtime] = useState(true);
  const [lockedWallet, setLockedWallet] = useState("");
  const isLocked = proofStatus === "approved";
  const draftLoaded = useRef(false);

  useEffect(() => {
    if (proofStatus === "rejected") {
      showToast("Hồ sơ bị từ chối. Bạn có thể chỉnh sửa và gửi lại.", "warning");
    }
    if (proofStatus !== "draft" && walletAddress && !lockedWallet) {
      setLockedWallet(walletAddress);
    }
    if (lockedWallet && walletAddress && walletAddress !== lockedWallet) {
      setErr("Wallet mismatch với hồ sơ đã nộp. Vui lòng đổi về ví đã dùng để nộp.");
      showToast("Wallet khác ví đã nộp hồ sơ. Đổi lại ví cũ để tiếp tục.", "error");
    }
  }, [proofStatus, showToast, walletAddress, lockedWallet]);

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

      const emailName = String(user.email || "").split("@")[0] || user.id;
      const name = p?.name?.trim() ? p.name.trim() : emailName;
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

  // fetch() has no standard upload progress, use staged progress for UX
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
    setMetaHashHexState("");
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
  const royaltyOk = useMemo(() => {
    const n = Number(royalty);
    return Number.isFinite(n) && n >= 0 && n <= 100;
  }, [royalty]);

  const exclusivePriceNum = useMemo(() => {
    const n = Number(String(exclusivePrice || "").trim().replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  }, [exclusivePrice]);

  const licensePriceNum = useMemo(() => {
    const n = Number(String(licensePrice || "").trim().replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  }, [licensePrice]);

  const sellTypeU8 = useMemo(() => {
    if (sellType === "exclusive") return 1;
    if (sellType === "license") return 2;
    return 0;
  }, [sellType]);

  const priceHint = useMemo(() => {
    if (sellType === "exclusive") return "Gợi ý: 1 – 10 SUI cho quyền sở hữu độc quyền.";
    if (sellType === "license") return "Gợi ý: 0.1 – 1 SUI cho license không độc quyền.";
    return "Không bán: đặt giá = 0.";
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

  const finalGenre = useMemo(() => {
    if (category === "Other") {
      return customGenre.trim();
    }
    return category.trim();
  }, [category, customGenre]);

  const categoryOk = useMemo(() => {
    if (category === "Other") {
      return customGenre.trim().length > 0;
    }
    return category.trim().length > 0;
  }, [category, customGenre]);
  const languageOk = useMemo(() => language.trim().length > 0, [language]);

  const durationOk = useMemo(() => {
    if (!file) return false;
    if (isMediaFile(file)) return !!fileDuration && fileDuration > 0;
    return true;
  }, [file, fileDuration]);

  const sellPriceOk = useMemo(() => {
    if (sellType === "exclusive") return exclusivePriceNum > 0;
    if (sellType === "license") return licensePriceNum > 0;
    return true;
  }, [sellType, exclusivePriceNum, licensePriceNum]);

  const canGoStep1 = useMemo(() => {
    if (title.trim().length < 3) return false;
    if (!file) return false;
    if (!durationOk) return false;
    if (!categoryOk) return false;
    if (!languageOk) return false;
    if (!royaltyOk) return false;
    if (!createdDateOk) return false;
    return true;
  }, [title, file, durationOk, categoryOk, languageOk, royaltyOk, createdDateOk]);

  const canGoStep2 = useMemo(() => {
    if (!sellPriceOk) return false;
    if (!royaltyOk) return false;
    if (lockedWallet && walletAddress !== lockedWallet) return false;
    return true;
  }, [sellPriceOk, royaltyOk, lockedWallet, walletAddress]);

  const canSubmit = useMemo(() => {
    if (!configOk) return false;
    if (!user?.id) return false;
    if (!walletAddress) return false;
    if (lockedWallet && walletAddress !== lockedWallet) return false;
    if (!title.trim() || title.trim().length < 3) return false;
    if (!file) return false;
    if (!durationOk) return false;
    if (!categoryOk) return false;
    if (!languageOk) return false;
    if (!createdDateOk) return false;
    if (!royaltyOk) return false;
    if (!sellPriceOk) return false;
    if (uploading) return false;
    if (isPending) return false;
    return true;
  }, [
    configOk,
    user?.id,
    walletAddress,
    title,
    file,
    durationOk,
    categoryOk,
    languageOk,
    createdDateOk,
    royaltyOk,
    sellPriceOk,
    uploading,
    isPending,
    lockedWallet,
    walletAddress,
  ]);

  const canMint = useMemo(() => canSubmit && termsAccepted, [canSubmit, termsAccepted]);

  useEffect(() => setErr(null), [
    step,
    sellType,
    usageRights,
    activeNet,
    exclusivePrice,
    licensePrice,
    royalty,
  ]);

  async function refreshProofStatus() {
    if (step !== 3 || !proofId) return;
    try {
      showToast("Refreshing profile status...", "info");
      const res = await fetch(`/api/proof/${encodeURIComponent(proofId)}`);
      const data: any = await readApi(res);
      if (data?.ok && data?.proof?.status) {
        setProofStatus(data.proof.status);
        showToast("Profile status updated.", "success");
      }
    } catch {
      // keep current status
      showToast("Unable to refresh profile status.", "error");
    }
  }

  useEffect(() => {
    if (step !== 3 || !proofId) return;
    const ref = doc(db, "proofs", proofId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data: any = snap.data();
        if (data?.status) {
          const next = String(data.status) as
            | "draft"
            | "submitted"
            | "tsa_attested"
            | "approved"
            | "rejected";
          setProofStatus(next);
          if (!lockedWallet && snap.exists() && snap.data()?.authorWallet && typeof snap.data().authorWallet === "string") {
            const lw = String(snap.data().authorWallet).trim();
            if (lw) setLockedWallet(lw);
          }
        }
        setProofRealtime(true);
      },
      () => {
        setProofRealtime(false);
      }
    );
    return () => unsub();
  }, [step, proofId]);


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
  function normalizeWalrusResult(result: any, f: File): UploadResult {
    if (result?.ok === false) {
      throw new Error(result?.error || "Upload failed");
    }
    const blobId = pickBlobId(result);
    if (!blobId) throw new Error("Walrus response missing blob id");
    const url = pickUrl(result) || `/api/walrus/blob/${blobId}`;
    return {
      cid: blobId,
      url,
      name: f.name,
      size: f.size,
      type: f.type,
    };
  }

  function xhrUpload(
    url: string,
    fd: FormData,
    headers?: Record<string, string>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);

      if (headers) {
        for (const [k, v] of Object.entries(headers)) {
          xhr.setRequestHeader(k, v);
        }
      }

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        setUploadPct(pct);
      };

      xhr.onload = () => {
        const text = xhr.responseText || "";
        if (xhr.status < 200 || xhr.status >= 300) {
          const err = new Error(text || `HTTP ${xhr.status}`) as Error & {
            status?: number;
            body?: string;
          };
          err.status = xhr.status;
          err.body = text;
          return reject(err);
        }
        if (!text) return resolve({});
        try {
          return resolve(JSON.parse(text));
        } catch {
          return resolve(text);
        }
      };

      xhr.onerror = () => {
        const err = new Error("Network error") as Error & { status?: number };
        err.status = xhr.status || 0;
        reject(err);
      };

      xhr.send(fd);
    });
  }

  async function uploadDirectToWalrus(f: File): Promise<UploadResult> {
    if (!CAN_DIRECT_UPLOAD) {
      throw new Error("Direct upload is not configured.");
    }

    const candidates = buildUploadCandidates(
      DIRECT_WALRUS_ENDPOINT,
      DIRECT_WALRUS_EPOCHS
    );
    const headers = DIRECT_WALRUS_API_KEY
      ? {
          Authorization: `Bearer ${DIRECT_WALRUS_API_KEY}`,
          "X-API-Key": DIRECT_WALRUS_API_KEY,
        }
      : undefined;

    let lastErr: any = null;

    for (const url of candidates) {
      const fd = new FormData();
      fd.append("file", f, f.name);
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await xhrUpload(url, fd, headers);
        return normalizeWalrusResult(result, f);
      } catch (e: any) {
        const status = e?.status;
        lastErr = e;
        if (status !== 404 && status !== 405) break;
      }
    }

    throw lastErr || new Error("Walrus upload failed");
  }

  async function uploadToWalrusFile(
    f: File,
    kind: "audio" | "cover"
  ): Promise<UploadResult> {
    setUploading(true);
    setUploadStage(kind === "audio" ? "upload_file" : "upload_cover");
    setUploadPct(0);

    try {
      if (isOverServerLimit(f) && CAN_DIRECT_UPLOAD) {
        showToast("Server limit hit. Uploading directly to Walrus...", "info");
        const direct = await uploadDirectToWalrus(f);
        setUploadStage("done");
        setTimeout(() => setUploadPct(0), 800);
        showToast("Walrus upload successful.", "success");
        return direct;
      }

      guardSize(f);
      showToast(
        kind === "audio" ? "Uploading file to Walrus..." : "Uploading cover to Walrus...",
        "info"
      );
      const fd = new FormData();
      fd.append("file", f, f.name);
      fd.append("kind", kind);

      let result: any;
      try {
        result = await xhrUpload("/api/walrus/upload-file", fd);
      } catch (e: any) {
        const msg = String(e?.message || "");
        const isLimit =
          e?.status === 413 ||
          msg.includes("413") ||
          msg.toLowerCase().includes("too large");
        if (isLimit && CAN_DIRECT_UPLOAD) {
          showToast("Server limit hit. Uploading directly to Walrus...", "info");
          const direct = await uploadDirectToWalrus(f);
          setUploadStage("done");
          setTimeout(() => setUploadPct(0), 800);
          showToast("Walrus upload successful.", "success");
          return direct;
        }
        throw e;
      }

      const normalized = normalizeWalrusResult(result, f);

      setUploadStage("done");
      setTimeout(() => setUploadPct(0), 800);
      showToast("Walrus upload successful.", "success");

      return normalized;
    } catch (e: any) {
      const status = e?.status ? ` (HTTP ${e.status})` : "";
      const body =
        e?.body && typeof e.body === "string"
          ? e.body.slice(0, 180)
          : "";
      const msg =
        `${e?.message || "Upload failed."}${status}` +
        (body ? `: ${body}` : "");
      showToast(msg, "error");
      throw e;
    } finally {
      setUploading(false);
    }
  }


  async function uploadJSONToWalrus(json: any): Promise<{ blobId: string; url: string }> {
    setUploading(true);
    const stop = startFakeProgress("upload_meta");

    try {
      showToast("Uploading metadata to Walrus...", "info");
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
      showToast("Metadata upload successful.", "success");

      return { blobId: data.blobId, url: data.url };
    } catch (e: any) {
      showToast(e?.message || "Metadata upload failed.", "error");
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

  function readDraft(userId: string) {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("chainstorm_register_draft");
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.userId !== userId) return null;
      return data;
    } catch {
      return null;
    }
  }

  function saveDraft(userId: string, patch: Record<string, any>) {
    if (typeof window === "undefined") return;
    try {
      const current = readDraft(userId) || { userId };
      const next = { ...current, ...patch, updatedAt: Date.now() };
      window.localStorage.setItem("chainstorm_register_draft", JSON.stringify(next));
    } catch {
      // ignore storage errors
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
    if (!user?.id) throw new Error("You need to sign in.");
    if (!file) throw new Error("You have not selected a work file.");

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
    if (!fBlobId) throw new Error("Uploading file to Walrus failed.");

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
    const emailName = String(user.email || "").split("@")[0] || user.id;
    const aName = profile?.name?.trim() ? profile.name.trim() : emailName;

    const createdISO = createdDate.trim()
      ? parseDDMMYYYYToISO(createdDate.trim())
      : null;

    if (createdDate.trim() && !createdISO) {
      throw new Error("Invalid creation date. Correct format: dd/mm/yyyy");
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
          { trait_type: "exclusive_price_sui", value: exclusivePriceNum },
          { trait_type: "license_price_sui", value: licensePriceNum },
          { trait_type: "usage_rights", value: usageRights },
          { trait_type: "ai_training_allowed", value: usageRights === "ai" },
          ...(finalGenre ? [{ trait_type: "category", value: finalGenre }] : []),
        ...(language.trim() ? [{ trait_type: "language", value: language.trim() }] : []),
        ...(createdDate.trim()
          ? [{ trait_type: "createdDate", value: createdDate.trim() }]
          : []),
      ],

      properties: {
        app: "Chainstorm",
        network: activeNet,

          category: finalGenre || "",
        language: language.trim() || "",
        createdDate: createdDate.trim() || "",
        createdAtISO: createdISO || "",
        usageRights,
        aiTrainingAllowed: usageRights === "ai",

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

    let metaBlob = metaBlobId;
    let metaLink = metaUrl;

    if (!metaBlob || metaHashHexState !== metaHashHex) {
      const meta = await uploadJSONToWalrus(metadata);
      if (!meta.blobId) throw new Error("Uploading metadata to Walrus failed.");
      metaBlob = meta.blobId;
      metaLink = meta.url;
      setMetaHashHexState(metaHashHex);
    } else if (!metaLink) {
      metaLink = `/api/walrus/blob/${metaBlob}`;
      setMetaUrl(metaLink);
    }

    if (fileHashBytes.length !== 32 || metaHashBytes.length !== 32) {
      throw new Error("Hash bytes must be 32 bytes.");
    }

    return {
      metadataBlobId: metaBlob,
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

  useEffect(() => {
    if (!user?.id) return;
    if (draftLoaded.current) return;
    const draft = readDraft(user.id);
    if (!draft) return;

    draftLoaded.current = true;

    if (!title && draft.title) setTitle(draft.title);
    if (!category && draft.category) {
      const predefinedGenres = ["Pop", "Rock", "Hip-Hop/Rap", "Electronic/Dance", "Jazz", "Classical", "Country", "R&B/Soul", "Reggae", "Folk", "Alternative"];
      if (predefinedGenres.includes(draft.category)) {
        setCategory(draft.category);
      } else {
        setCategory("Other");
        setCustomGenre(draft.category);
      }
    }
    if (!language && draft.language) setLanguage(draft.language);
    if (!createdDate && draft.createdDate) setCreatedDate(draft.createdDate);
    if (royalty === "5" && draft.royalty) setRoyalty(draft.royalty);
    if (draft.sellType) setSellType(draft.sellType);
    if (usageRights === "standard" && draft.usageRights) {
      setUsageRights(draft.usageRights);
    }
    if (exclusivePrice === "1" && draft.exclusivePrice) setExclusivePrice(draft.exclusivePrice);
    if (licensePrice === "0.1" && draft.licensePrice) setLicensePrice(draft.licensePrice);

    if (!fileBlobId && draft.fileBlobId) setFileBlobId(draft.fileBlobId);
    if (!fileUrl && draft.fileUrl) setFileUrl(draft.fileUrl);
    if (!coverBlobId && draft.coverBlobId) setCoverBlobId(draft.coverBlobId);
    if (!coverUrl && draft.coverUrl) setCoverUrl(draft.coverUrl);
    if (!metaBlobId && draft.metaBlobId) setMetaBlobId(draft.metaBlobId);
    if (!metaUrl && draft.metaUrl) setMetaUrl(draft.metaUrl);
    if (!metaHashHexState && draft.metaHashHexState) setMetaHashHexState(draft.metaHashHexState);
    if (!proofId && draft.proofId) setProofId(draft.proofId);
    if (proofStatus === "draft" && draft.proofStatus) setProofStatus(draft.proofStatus);
    if (!lockedWallet && draft.lockedWallet) setLockedWallet(draft.lockedWallet);
  }, [
    user?.id,
    title,
    category,
    language,
    createdDate,
    royalty,
    sellType,
    usageRights,
    fileBlobId,
    fileUrl,
    coverBlobId,
    coverUrl,
    metaBlobId,
    metaUrl,
    metaHashHexState,
    proofId,
    proofStatus,
    lockedWallet,
  ]);

  useEffect(() => {
    if (!user?.id) return;
    saveDraft(user.id, {
      title,
      category,
      language,
      createdDate,
      royalty,
      sellType,
      usageRights,
      exclusivePrice,
      licensePrice,
      fileBlobId,
      fileUrl,
      coverBlobId,
      coverUrl,
      metaBlobId,
      metaUrl,
      metaHashHexState,
      proofId,
      proofStatus,
      lockedWallet,
    });
  }, [
    user?.id,
    title,
    category,
    language,
    createdDate,
    royalty,
    sellType,
    usageRights,
    exclusivePrice,
    licensePrice,
    fileBlobId,
    fileUrl,
    coverBlobId,
    coverUrl,
    metaBlobId,
    metaUrl,
    metaHashHexState,
    proofId,
    proofStatus,
    lockedWallet,
  ]);

  useEffect(() => {
    if (proofRealtime) return;
    if (step !== 3 || !proofId) return;
    if (proofStatus === "approved" || proofStatus === "rejected") return;
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      try {
        const res = await fetch(`/api/proof/${encodeURIComponent(proofId)}`);
        const data: any = await readApi(res);
        if (data?.ok && data?.proof?.status) {
          setProofStatus(data.proof.status);
        }
      } catch {
        // silent
      }
    };
    const id = window.setInterval(tick, 8000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [proofRealtime, step, proofId, proofStatus]);

  /* =======================
     ✅ step nav
  ======================= */
  function next() {
    if (step === 1) {
      if (!canGoStep1) {
        setErr(
          "Enter a title (>=3 characters), choose a file with duration, add category + language, and check the creation date (dd/mm/yyyy) before continuing."
        );
        showToast(
          "Missing info in Step 1. Check title/file/duration/category/language/royalty/creation date.",
          "warning"
        );
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!canGoStep2) {
        setErr("Price must be > 0 for the selected sale type and royalty must be 0-100.");
        showToast("Sale price/royalty invalid.", "warning");
        return;
      }
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
          `Missing on-chain config for "${activeNet}". Fill in packageId + registryId in chainstormConfig.ts or .env`
        );
        showToast("Missing on-chain config. Check chainstormConfig.ts or .env", "error");
        return null;
      }

      if (!canSubmit) {
        setErr(
          "Please check: signed in, wallet connected, valid file/title, correct creation date (dd/mm/yyyy)."
        );
        showToast("Submission requirements not met.", "warning");
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
        throw new Error("The signing wallet does not match the connected wallet.");
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
        throw new Error(proofData?.error || "Legal submission failed.");
      }

      const proof = proofData?.proof;
      setProofId(proof?.id || "");
      setProofStatus(proof?.status || "submitted");
      if (proof?.id) {
        await setDoc(
          doc(db, "proofs", proof.id),
          {
            authorId: user!.id,
            status: proof?.status || "submitted",
            title: title.trim() || "Untitled",
            walrusMetaId: metadataBlobId,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      showToast("Submission sent. Waiting for admin review.", "success");

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
          exclusivePriceSui: exclusivePriceNum,
          licensePriceSui: licensePriceNum,
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
          category: finalGenre || undefined,
          language: language.trim() || undefined,
          createdDate: createdDate.trim() || undefined,
          sellType,
          royalty: royaltyNum,
          exclusivePriceSui: exclusivePriceNum,
          licensePriceSui: licensePriceNum,
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
          `Missing on-chain config for "${activeNet}". Fill in packageId + registryId in chainstormConfig.ts or .env`
        );
        showToast("Missing on-chain config. Check chainstormConfig.ts or .env", "error");
        return;
      }

      if (!canSubmit) {
        setErr(
          "Please check: signed in, wallet connected, valid file/title, duration, category, language, royalty 0-100, valid price, correct creation date (dd/mm/yyyy)."
        );
        showToast("Mint requirements not met.", "warning");
        return;
      }

      if (!termsAccepted) {
        setErr("Please accept the terms to mint this work.");
        showToast("Please accept the terms before minting.", "warning");
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
          throw new Error(data?.error || "Unable to fetch legal submission.");
        }
        proof = data?.proof;
        setProofStatus(proof?.status || "submitted");
        if (!proof?.approval || proof?.status !== "approved") {
          setErr("Submission sent. Wait for admin review before minting.");
          showToast("Submission not approved yet.", "warning");
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
        fileHashBytes32 = hexToBytes32(String(proof?.fileHash || ""));
        metaHashBytes32 = hexToBytes32(String(proof?.metaHash || ""));
      } else {
        const submitted = await submitProof();
        if (!submitted?.proof) {
          return;
        }
        proof = submitted.proof;
        setProofStatus(proof?.status || "submitted");
        if (!proof?.approval || proof?.status !== "approved") {
          setErr("Submission sent. Wait for admin review before minting.");
          showToast("Submission not approved yet.", "warning");
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
        throw new Error("Missing hash for minting. Please resubmit.");
      }

      // ensure profileStore has email/avatar (if Auth has it but profileStore does not)
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
          category: finalGenre || undefined,
          language: language.trim() || undefined,
          createdDate: createdDate.trim() || undefined,
          sellType,
          royalty: royaltyNum,
          exclusivePriceSui: exclusivePriceNum,
          licensePriceSui: licensePriceNum,
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
      if (!digest) throw new Error("No digest received from transaction.");

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
          "Mint succeeded but could not read WorkNFT objectId. Reopen the transaction and try again."
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

      showToast("Mint successful.", "success");
      syncWorksFromChain({ network: activeNet, force: true });
      router.push("/manage");
    } catch (e: any) {
      const msg = String(e?.message || e);

      if (msg.includes("Package object does not exist")) {
        setErr(
          `PACKAGE_ID does not exist on "${activeNet}". Check Sui Wallet network + chainstormConfig.ts`
        );
        showToast("PACKAGE_ID does not exist on network.", "error");
      } else if (msg.includes("Object does not exist") && msg.includes(REGISTRY_ID)) {
        setErr(
          `REGISTRY_ID does not exist on "${activeNet}". Did you init_registry? (registry must be a Shared object)`
        );
        showToast("REGISTRY_ID does not exist on network.", "error");
      } else if (msg.includes("100") || msg.toLowerCase().includes("duplicate")) {
        setErr("DUPLICATE_HASH (100): Duplicate hash. Upload new metadata or change the work.");
        showToast("Duplicate hash. Please change the work.", "error");
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
            <b>Not signed in.</b>
            <div className={styles.warnText}>Please sign in to register a work.</div>
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
            <h1 className={styles.title}>Register work</h1>
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
                {walletAddress ? shortAddr(walletAddress) : "Wallet not connected"}
              </div>

              <div className={styles.monoSmall}>
                pkg: {PACKAGE_ID ? shortAddr(PACKAGE_ID) : "missing"} • reg:{" "}
                {REGISTRY_ID ? shortAddr(REGISTRY_ID) : "missing"}
              </div>
            </div>
            <button
              className={styles.btnGhost}
              onClick={() => {
                if (typeof window === "undefined") return;
                window.localStorage.removeItem("chainstorm_register_draft");
                showToast("Draft cleared. Starting fresh.", "success");
                window.location.reload();
              }}
              title="Clear draft and restart"
            >
              Reset
            </button>
            <div className={styles.stepBadge}>Step {step}/3</div>
          </div>
        </div>

        {!configOk ? (
          <div className={styles.warn}>
            <b>Missing on-chain config.</b>
            <div className={styles.warnText}>
              Fill in <b>packageId</b> + <b>registryId</b> (Registry shared) in{" "}
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
              {step === 1 && "Step 1 - Audio/file, cover & info"}
              {step === 2 && "Step 2 - Sale / License"}
              {step === 3 && (
                <span className={styles.stepTitleRow}>
                  <span>Step 3 - Confirm & Mint</span>
                  {proofStatus === "approved" ? (
                    <span className={styles.badgeSuccess}>Approved</span>
                  ) : proofStatus === "rejected" ? (
                    <span className={styles.badgeError}>Rejected</span>
                  ) : (
                    <span className={styles.badgeMuted}>{proofStatus}</span>
                  )}
                </span>
              )}
            </div>
            <div className={styles.progress}>
              <div className={styles.progressBar} style={{ width: `${(step / 3) * 100}%` }} />
            </div>
          </div>

          {step === 1 && (
            <div className={styles.grid}>
              <label className={styles.field}>
                <span className={styles.label}>Title</span>
                <input
                  className={styles.input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isLocked}
                  placeholder="Example: Music / Painting / Photo..."
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Genre</span>
                <select
                  className={styles.input}
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    if (e.target.value !== "Other") {
                      setCustomGenre("");
                    }
                  }}
                  disabled={isLocked}
                >
                  <option value="">Select genre...</option>
                  <option value="Pop">Pop</option>
                  <option value="Rock">Rock</option>
                  <option value="Hip-Hop/Rap">Hip-Hop/Rap</option>
                  <option value="Electronic/Dance">Electronic/Dance</option>
                  <option value="Jazz">Jazz</option>
                  <option value="Classical">Classical</option>
                  <option value="Country">Country</option>
                  <option value="R&B/Soul">R&B/Soul</option>
                  <option value="Reggae">Reggae</option>
                  <option value="Folk">Folk</option>
                  <option value="Alternative">Alternative</option>
                  <option value="Other">Other</option>
                </select>
                {category === "Other" && (
                  <input
                    className={styles.input}
                    value={customGenre}
                    onChange={(e) => setCustomGenre(e.target.value)}
                    disabled={isLocked}
                    placeholder="Enter custom genre..."
                    style={{ marginTop: "0.5rem" }}
                  />
                )}
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Language (optional)</span>
                <input
                  className={styles.input}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={isLocked}
                  placeholder="vi / en / ja..."
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Creation date (dd/mm/yyyy)</span>
                <input
                  className={styles.input}
                  value={createdDate}
                  onChange={(e) => setCreatedDate(e.target.value)}
                  disabled={isLocked}
                  placeholder="25/12/2025"
                />
                <span className={styles.help}>
                  {createdDate.trim()
                    ? createdDateOk
                      ? "Valid"
                      : "Invalid format or date"
                    : "Optional"}
                </span>
              </label>

              {/* AUDIO/FILE WORK */}
              <label className={styles.fieldFull}>
                <span className={styles.label}>Audio / Work file</span>
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
                    disabled={isLocked}
                  />

                  <button
                    type="button"
                    className={styles.btn}
                    disabled={!file || uploading || submitting || isPending || isLocked}
                    onClick={async () => {
                      try {
                        setErr(null);
                        if (!file) return;
                        const r = await uploadToWalrusFile(file, "audio");
                        setFileBlobId(r.cid);
                        setFileUrl(r.url);
                      } catch (e: any) {
                        setErr(e?.message ?? "Upload failed.");
                      }
                    }}
                  >
                    {uploading && uploadStage === "upload_file" ? "Uploading..." : "Upload Walrus"}
                  </button>
                </div>

                <div className={styles.ipfsInfo}>
                  <div className={styles.ipfsLine}>
                    <span className={styles.badge} data-ok={!!fileBlobId}>
                      File Blob ID
                    </span>
                    <span className={styles.mono}>
                      {fileBlobId ? shortCid(fileBlobId) : "Not set"}
                    </span>
                    {fileUrl ? (
                      <a className={styles.link} href={fileUrl} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : null}
                  </div>
                  <div className={styles.ipfsHint}>
                    Mint will hash file + metadata &rarr; 32 bytes &rarr; prevent duplicate hashes.
                  </div>
                </div>
              </label>

              {/* COVER */}
              <label className={styles.fieldFull}>
                <span className={styles.label}>Cover image (recommended)</span>
                <div className={styles.fileRow}>
                  <input
                    className={styles.file}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;

                      if (f && !f.type.startsWith("image/")) {
                        setErr("Cover must be an image (image/*).");
                        e.currentTarget.value = "";
                        return;
                      }

                      setCover(f);
                      // only reset cover/meta (keep file if present)
                      setErr(null);
                      setCoverBlobId("");
                      setCoverUrl("");
                      setMetaBlobId("");
                      setMetaUrl("");
                      setMetaHashHexState("");
                      setUploadStage("idle");
                      setUploadPct(0);
                      setProofId("");
                    }}
                    disabled={isLocked}
                  />

                  <button
                    type="button"
                    className={styles.btn}
                    disabled={!cover || uploading || submitting || isPending || isLocked}
                    onClick={async () => {
                      try {
                        setErr(null);
                        if (!cover) return;
                        const r = await uploadToWalrusFile(cover, "cover");
                        setCoverBlobId(r.cid);
                        setCoverUrl(r.url);
                      } catch (e: any) {
                        setErr(e?.message ?? "Cover upload failed.");
                      }
                    }}
                  >
                    {uploading && uploadStage === "upload_cover" ? "Uploading..." : "Upload cover"}
                  </button>
                </div>

                <div className={styles.ipfsInfo}>
                  <div className={styles.ipfsLine}>
                    <span className={styles.badge} data-ok={!!coverBlobId}>
                      Cover Blob ID
                    </span>
                    <span className={styles.mono}>
                      {coverBlobId ? shortCid(coverBlobId) : "Not set"}
                    </span>
                    {coverUrl ? (
                      <a className={styles.link} href={coverUrl} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : null}
                  </div>
                  <div className={styles.ipfsHint}>
                    Cover will be set to <b>metadata.image</b>. If left empty and the file is an image,
                    use the file as the image; otherwise the card may have no cover.
                  </div>
                </div>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className={styles.grid}>
              <label className={styles.field}>
                <span className={styles.label}>Type</span>
                <select
                  className={styles.input}
                  value={sellType}
                  onChange={(e) => setSellType(e.target.value as SellTypeUI)}
                  disabled={isLocked}
                >
                  <option value="exclusive">Exclusive</option>
                  <option value="license">License</option>
                  <option value="none">Not for sale</option>
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Quyền khai thác</span>
                <select
                  className={styles.input}
                  value={usageRights}
                  onChange={(e) => setUsageRights(e.target.value as UsageRightsUI)}
                  disabled={isLocked}
                >
                  <option value="standard">Tiêu chuẩn (theo Type)</option>
                  <option value="ai">AI / Platform Membership</option>
                </select>
                <span className={styles.help}>
                  AI/Platform cho phép truy cập dữ liệu và huấn luyện hợp pháp theo điều khoản.
                </span>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Royalty (%)</span>
                <input
                  className={styles.input}
                  value={royalty}
                  onChange={(e) => setRoyalty(e.target.value)}
                  placeholder="Example: 5"
                  disabled={isLocked}
                />
                <span className={styles.help}>0-100% (stored on-chain as u8)</span>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Exclusive price (SUI)</span>
                <input
                  className={styles.input}
                  value={exclusivePrice}
                  onChange={(e) => setExclusivePrice(e.target.value)}
                  placeholder="Example: 1"
                  disabled={isLocked}
                />
                <span className={styles.help}>
                  Full ownership transfer. 0 = not for exclusive sale. {sellType === "exclusive" ? priceHint : ""}
                </span>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>License price (SUI)</span>
                <input
                  className={styles.input}
                  value={licensePrice}
                  onChange={(e) => setLicensePrice(e.target.value)}
                  placeholder="Example: 0.1"
                  disabled={isLocked}
                />
                <span className={styles.help}>
                  Non-exclusive usage license. 0 = no license offer. {sellType === "license" ? priceHint : ""}
                </span>
              </label>

              <div className={styles.reviewCard}>
                <div className={styles.reviewTitle}>Review process</div>
                <div className={styles.reviewText}>
                  Work enters <b>pending</b> status &rarr; <b>verified</b> once quorum is met.
                </div>
              </div>

              <div className={styles.reviewCard}>
                <div className={styles.reviewTitle}>Price types</div>
                <div className={styles.reviewText}>
                  <b>Exclusive</b> transfers full ownership; <b>License</b> grants usage rights without
                  transferring ownership; <b>Membership</b> (platform) unlocks access and is managed in
                  the membership section.
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
              <Row label="Author" value={authorName} />
              <Row label="Email" value={authorEmail || user?.email || "-"} />
              <Row label="Wallet" value={walletAddress ? shortAddr(walletAddress) : "-"} mono />
              <Row label="Title" value={title || "-"} />
              <Row label="Genre" value={finalGenre || "-"} />
              <Row label="Language" value={language || "-"} />
              <Row label="Creation date" value={createdDate || "-"} />
              <Row label="SellType" value={`${sellType} (u8=${sellTypeU8})`} />
              <Row
                label="Usage rights"
                value={usageRights === "ai" ? "AI / Platform Membership" : "Standard"}
              />
              <Row label="Royalty" value={`${royaltyNum}%`} />
              <Row label="Exclusive price" value={`${exclusivePriceNum} SUI`} />
              <Row label="License price" value={`${licensePriceNum} SUI`} />
              <Row label="File Blob ID" value={fileBlobId ? shortCid(fileBlobId) : "Not set"} mono />
              <Row label="Cover Blob ID" value={coverBlobId ? shortCid(coverBlobId) : "Not set"} mono />
              <Row
                label="Metadata Blob ID"
                value={metaBlobId ? shortCid(metaBlobId) : "Will be created on mint"}
                mono
              />
              <Row label="Proof ID" value={proofId || "Not set"} mono />
              <Row
                label="Proof status"
                value={proofStatus === "draft" ? "Not submitted" : proofStatus}
              />
              {lockedWallet ? (
                <Row label="Wallet locked" value={shortAddr(lockedWallet)} />
              ) : null}
              {lockedWallet && walletAddress && walletAddress !== lockedWallet ? (
                <div className={styles.calloutError}>
                  Ví hiện tại ({shortAddr(walletAddress)}) khác ví đã nộp hồ sơ ({shortAddr(
                    lockedWallet
                  )}). Hãy đổi về ví đã nộp để tiếp tục.
                </div>
              ) : null}
              {proofStatus === "rejected" ? (
                <div className={styles.calloutError}>
                  Hồ sơ đã bị từ chối. Bạn có thể chỉnh sửa thông tin và nhấn “Submit filing” để gửi lại.
                </div>
              ) : null}
              <div className={styles.metaLinkRow}>
                <span className={styles.muted}>
                  Trạng thái tự động cập nhật realtime; không cần nhấn refresh.
                </span>
              </div>

              {proofStatus !== "approved" ? (
                <div className={styles.callout}>
                  Submission must be reviewed by admin before minting. Go to{" "}
                  <b>/admin/review</b> to review.
                </div>
              ) : null}

              <div className={styles.callout}>
                <div className={styles.reviewTitle}>Điều khoản ngắn</div>
                <div className={styles.reviewText}>
                  Bạn xác nhận có quyền sở hữu/tác quyền với tác phẩm, không vi phạm pháp luật.
                  {usageRights === "ai"
                    ? " Đồng ý cho AI/Platform truy cập dữ liệu và huấn luyện hợp pháp."
                    : " Quyền khai thác theo lựa chọn ở bước 2."}
                </div>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                  />
                  <span>Tôi đồng ý với các điều khoản trên</span>
                </label>
              </div>


              {metaUrl ? (
                <div className={styles.metaLinkRow}>
                  <a className={styles.link} href={metaUrl} target="_blank" rel="noreferrer">
                    Open metadata on gateway
                  </a>
                </div>
              ) : null}

              <div className={styles.callout}>
                Mint will hash <b>file + metadata</b> (SHA-256) &rarr; <b>32 bytes</b> &rarr; Move to
                prevent duplicates.
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
              Back
            </button>

          <div className={styles.actionsRight}>
              {step < 3 ? (
                <button
                  className={styles.btnPrimary}
                  onClick={next}
                  disabled={(step === 1 && !canGoStep1) || submitting || isPending || uploading}
                >
                  Next
                </button>
              ) : (
                <>
                  <button
                    className={styles.btnGhost}
                    onClick={submitProof}
                    disabled={!canSubmit || submitting || isPending || uploading || isLocked}
                    title="Submit legal filing (off-chain)"
                  >
                    Submit filing
                  </button>
                  <button
                    className={styles.btnPrimary}
                    onClick={onSubmit}
                    disabled={
                      !canMint ||
                      proofStatus !== "approved" ||
                      submitting ||
                      isPending ||
                      uploading
                    }
                    title={
                      proofStatus !== "approved"
                        ? "Submission not approved"
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
                        : "Minting..."
                      : "Mint"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={styles.footerNote}>
          Tip: Upload file + cover first to mint faster (Step 3 will not wait for upload).
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
