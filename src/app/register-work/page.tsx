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
      showToast(e?.message || "Upload failed.", "error");
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
    const aName = profile?.name?.trim() ? profile.name.trim() : "Unknown";

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
    if (!meta.blobId) throw new Error("Uploading metadata to Walrus failed.");

    if (fileHashBytes.length !== 32 || metaHashBytes.length !== 32) {
      throw new Error("Hash bytes must be 32 bytes.");
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
          "Enter a title (>=3 characters), choose a file, and check the creation date (dd/mm/yyyy) before continuing."
        );
        showToast(
          "Missing info in Step 1. Check title/file/creation date.",
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
          `Missing on-chain config for "${activeNet}". Fill in packageId + registryId in chainstormConfig.ts`
        );
        showToast("Missing on-chain config. Check chainstormConfig.ts", "error");
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
          `Missing on-chain config for "${activeNet}". Fill in packageId + registryId in chainstormConfig.ts`
        );
        showToast("Missing on-chain config. Check chainstormConfig.ts", "error");
        return;
      }

      if (!canSubmit) {
        setErr(
          "Please check: signed in, wallet connected, valid file/title, correct creation date (dd/mm/yyyy)."
        );
        showToast("Mint requirements not met.", "warning");
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
              {step === 3 && "Step 3 - Confirm & Mint"}
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
                  placeholder="Example: Music / Painting / Photo..."
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Category</span>
                <input
                  className={styles.input}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Example: Music / Photo / Design..."
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Language (optional)</span>
                <input
                  className={styles.input}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="vi / en / ja..."
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Creation date (dd/mm/yyyy)</span>
                <input
                  className={styles.input}
                  value={createdDate}
                  onChange={(e) => setCreatedDate(e.target.value)}
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
                >
                  <option value="exclusive">Exclusive</option>
                  <option value="license">License</option>
                  <option value="none">Not for sale</option>
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Royalty (%)</span>
                <input
                  className={styles.input}
                  value={royalty}
                  onChange={(e) => setRoyalty(e.target.value)}
                  placeholder="Example: 5"
                />
                <span className={styles.help}>0-100% (stored on-chain as u8)</span>
              </label>

              <div className={styles.reviewCard}>
                <div className={styles.reviewTitle}>Review process</div>
                <div className={styles.reviewText}>
                  Work enters <b>pending</b> status &rarr; <b>verified</b> once quorum is met.
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
              <Row label="Category" value={category || "-"} />
              <Row label="Language" value={language || "-"} />
              <Row label="Creation date" value={createdDate || "-"} />
              <Row label="SellType" value={`${sellType} (u8=${sellTypeU8})`} />
              <Row label="Royalty" value={`${royaltyNum}%`} />
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
              <div className={styles.metaLinkRow}>
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={refreshProofStatus}
                  disabled={!proofId || submitting || isPending || uploading}
                  title="Fetch latest status"
                >
                  Refresh status
                </button>
              </div>

              {proofStatus !== "approved" ? (
                <div className={styles.callout}>
                  Submission must be reviewed by admin before minting. Go to{" "}
                  <b>/admin/review</b> to review.
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
                    disabled={!canSubmit || submitting || isPending || uploading}
                    title="Submit legal filing (off-chain)"
                  >
                    Submit filing
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
