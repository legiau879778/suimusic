import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "IPFS/Pinata disabled. Use /api/walrus/upload-json instead.",
    },
    { status: 410 }
  );
}
