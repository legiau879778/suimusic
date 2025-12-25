// src/lib/ipfsClient.ts
import { readResponse } from "@/lib/http";

export const SERVERLESS_MAX_MB = 4; // Vercel thường ~4-5MB

export function assertFileSize(file: File, maxMb = SERVERLESS_MAX_MB) {
  const mb = file.size / 1024 / 1024;
  if (mb > maxMb) {
    throw new Error(
      `File quá lớn (${mb.toFixed(1)}MB). Giới hạn upload qua server ~${maxMb}MB. ` +
        `Hãy dùng file nhỏ hơn hoặc chuyển sang direct upload.`
    );
  }
}

export async function uploadFileToIpfs(file: File) {
  assertFileSize(file);

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/ipfs/upload", { method: "POST", body: fd });
  const data: any = await readResponse(res);

  if (!data?.ok) throw new Error(data?.error || "Upload failed");
  return data as { ok: true; cid: string; url: string; name: string; size: number; type: string };
}

export async function uploadJsonToIpfs(json: any) {
  const res = await fetch("/api/ipfs/upload-json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });

  const data: any = await readResponse(res);
  if (!data?.ok) throw new Error(data?.error || "Upload metadata failed");
  return data as { ok: true; cid: string; url: string };
}
