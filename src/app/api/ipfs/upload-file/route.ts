import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Missing file (form-data field: file)" },
        { status: 400 }
      );
    }

    // optional: chặn lớn quá
    const MAX_MB = 4;
    if (file.size > MAX_MB * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: `File too large. Max ${MAX_MB}MB` },
        { status: 413 }
      );
    }

    const fd = new FormData();
    fd.append("file", file, file.name);
    fd.append(
      "pinataMetadata",
      JSON.stringify({
        name: file.name,
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

    const data = JSON.parse(text) as { IpfsHash: string };
    const cid = data.IpfsHash;
    const url = `https://gateway.pinata.cloud/ipfs/${cid}`;

    return NextResponse.json({
      ok: true,
      cid,
      url,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
