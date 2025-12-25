import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json({ ok: false, error: "Missing PINATA_JWT" }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ ok: false, error: "No file" }, { status: 400 });
  }

  const fd = new FormData();
  fd.append("file", file, file.name);

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: fd,
  });

  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: text }, { status: 500 });
  }

  const data = JSON.parse(text);
  return NextResponse.json({
    ok: true,
    cid: data.IpfsHash,
    url: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`,
    name: file.name,
    size: file.size,
    type: file.type,
  });
}
