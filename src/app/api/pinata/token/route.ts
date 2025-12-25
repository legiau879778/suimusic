import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return NextResponse.json({ ok: false, error: "Missing PINATA_JWT" }, { status: 500 });

  // ⚠️ demo cho đồ án: trả JWT thẳng.
  // Production: nên dùng key có scope hạn chế / hoặc generate token ngắn hạn.
  return NextResponse.json({ ok: true, jwt });
}
