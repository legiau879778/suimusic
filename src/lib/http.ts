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

export async function POST(req: Request) {
  try {
    const jwt = mustEnv("PINATA_JWT");
    const body = await req.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { ok: false, error: `Pinata error: ${text}` },
        { status: 500 }
      );
    }

    const data = JSON.parse(text) as PinataJSONResp;
    const cid = data.IpfsHash;
    const url = `https://gateway.pinata.cloud/ipfs/${cid}`;

    return NextResponse.json({ ok: true, cid, url });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
