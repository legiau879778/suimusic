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

export type UploadFileOk = {
  ok: true;
  cid: string;
  url: string;
  name: string;
  size: number;
  type: string;
};

export type UploadJsonOk = {
  ok: true;
  cid: string;
  url: string;
};

function pickErr(data: any, fallback: string) {
  return data?.error || data?.message || fallback;
}

export async function uploadFileToIpfs(file: File): Promise<UploadFileOk> {
  assertFileSize(file);

  const fd = new FormData();
  fd.append("file", file, file.name);

  // ✅ thống nhất route: /api/ipfs/upload-file
  const res = await fetch("/api/ipfs/upload-file", { method: "POST", body: fd });
  const data: any = await readResponse(res);

  // ✅ ưu tiên HTTP status
  if (!res.ok) throw new Error(pickErr(data, `Upload failed (${res.status})`));
  if (!data?.ok) throw new Error(pickErr(data, "Upload failed"));

  return data as UploadFileOk;
}

export async function uploadJsonToIpfs(json: any): Promise<UploadJsonOk> {
  // ✅ thống nhất route: /api/ipfs/pin-json
  const res = await fetch("/api/ipfs/pin-json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });

  const data: any = await readResponse(res);

  if (!res.ok) throw new Error(pickErr(data, `Upload metadata failed (${res.status})`));
  if (!data?.ok) throw new Error(pickErr(data, "Upload metadata failed"));

  return data as UploadJsonOk;
}
