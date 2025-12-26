import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "IPFS/Pinata disabled. Use /api/walrus/upload-file instead.",
    },
    { status: 410 }
  );
}
