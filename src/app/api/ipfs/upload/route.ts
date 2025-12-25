// src/app/api/ipfs/upload/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PinataFileResp = {
  IpfsHash: string;
  PinSize: number;
  Timestamp?: string;
};

function mustEnv(key: string) {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

function json(ok: boolean, payload: any, status = 200) {
  return NextResponse.json({ ok, ...payload }, { status });
}

// ⚠️ Vercel serverless thường limit ~4-5MB request body.
// Bạn có thể chỉnh MAX_MB để báo lỗi sớm (dù Vercel có thể chặn trước khi vào route).
const MAX_MB = 4;

export async function POST(req: Request) {
  try {
    const jwt = mustEnv("PINATA_JWT");

    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof (file as any).arrayBuffer !== "function") {
      return json(false, { error: "Missing or invalid file field (file)" }, 400);
    }

    const f = file as File;

    // báo sớm để user hiểu (dù vercel có thể chặn trước khi vào đây)
    const sizeMb = f.size / 1024 / 1024;
    if (sizeMb > MAX_MB) {
      return json(
        false,
        {
          error: `File too large (${sizeMb.toFixed(1)}MB). Limit ~${MAX_MB}MB on serverless. Use smaller file or direct upload.`,
        },
        413
      );
    }

    const fd = new FormData();
    fd.append("file", f, f.name);

    fd.append(
      "pinataMetadata",
      JSON.stringify({
        name: f.name,
        keyvalues: { app: "chainstorm", kind: "work-file" },
      })
    );
    fd.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: fd,
    });

    const text = await res.text();

    if (!res.ok) {
      return json(false, { error: `Pinata error: ${text}` }, 502);
    }

    let data: PinataFileResp;
    try {
      data = JSON.parse(text) as PinataFileResp;
    } catch {
      return json(false, { error: `Pinata invalid JSON: ${text}` }, 502);
    }

    const cid = data.IpfsHash;
    const url = `https://gateway.pinata.cloud/ipfs/${cid}`;

    return json(true, {
      cid,
      url,
      name: f.name,
      size: f.size,
      type: f.type || "application/octet-stream",
      pinSize: data.PinSize,
      timestamp: data.Timestamp,
    });
  } catch (e: any) {
    console.error("[api/ipfs/upload] error:", e);
    return json(false, { error: e?.message || String(e) }, 500);
  }
}
