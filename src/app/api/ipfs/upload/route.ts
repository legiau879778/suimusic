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

export async function POST(req: Request) {
  try {
    const jwt = mustEnv("PINATA_JWT");

    const form = await req.formData();
    const file = form.get("file");

    // ✅ FIX: không dùng instanceof File
    if (!file || typeof (file as any).arrayBuffer !== "function") {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid file field" },
        { status: 400 }
      );
    }

    const f = file as File;

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
      return NextResponse.json(
        { ok: false, error: `Pinata error: ${text}` },
        { status: 500 }
      );
    }

    const data = JSON.parse(text) as PinataFileResp;
    const cid = data.IpfsHash;
    const url = `https://gateway.pinata.cloud/ipfs/${cid}`;

    return NextResponse.json({
      ok: true,
      cid,
      url,
      name: f.name,
      size: f.size,
      type: f.type || "application/octet-stream",
    });
  } catch (e: any) {
    console.error("[upload error]", e);
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
