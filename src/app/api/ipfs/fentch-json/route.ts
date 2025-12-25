// src/app/api/ipfs/fetch-json/route.ts
import { NextResponse } from "next/server";

function toGatewayUrl(input: string) {
  const v = (input || "").trim();
  if (!v) return "";

  if (v.startsWith("http://") || v.startsWith("https://")) return v;

  if (v.startsWith("ipfs://")) {
    const cid = v.replace("ipfs://", "");
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }

  return `https://gateway.pinata.cloud/ipfs/${v}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const src = searchParams.get("src") || "";
  const url = toGatewayUrl(src);

  if (!url) {
    return NextResponse.json({ ok: false, error: "Missing src" }, { status: 400 });
  }

  try {
    const r = await fetch(url, { cache: "no-store" });

    const text = await r.text();
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: `Upstream ${r.status}`, detail: text?.slice(0, 300) },
        { status: 502 }
      );
    }

    // cố parse json, fail thì trả text
    try {
      const data = JSON.parse(text);
      return NextResponse.json({ ok: true, data });
    } catch {
      return NextResponse.json(
        { ok: false, error: "Upstream is not JSON", detail: text?.slice(0, 300) },
        { status: 502 }
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Fetch failed" },
      { status: 500 }
    );
  }
}
