// src/app/api/ipfs/upload-json/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PinataJSONResp = {
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

export async function POST(req: Request) {
  try {
    const jwt = mustEnv("PINATA_JWT");

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return json(false, { error: "Invalid JSON body" }, 400);
    }

    if (!body || typeof body !== "object") {
      return json(false, { error: "Invalid JSON body" }, 400);
    }

    const payload = {
      pinataContent: body,
      pinataMetadata: {
        name: body?.name || "chainstorm-metadata",
        keyvalues: { app: "chainstorm", kind: "work-metadata" },
      },
      pinataOptions: { cidVersion: 1 },
    };

    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    if (!res.ok) {
      return json(false, { error: `Pinata error: ${text}` }, 502);
    }

    let data: PinataJSONResp;
    try {
      data = JSON.parse(text) as PinataJSONResp;
    } catch {
      return json(false, { error: `Pinata invalid JSON: ${text}` }, 502);
    }

    const cid = data.IpfsHash;
    const url = `https://gateway.pinata.cloud/ipfs/${cid}`;

    return json(true, { cid, url, pinSize: data.PinSize, timestamp: data.Timestamp });
  } catch (e: any) {
    console.error("[api/ipfs/upload-json] error:", e);
    return json(false, { error: e?.message || String(e) }, 500);
  }
}
