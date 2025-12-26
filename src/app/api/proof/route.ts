import { NextResponse } from "next/server";
import { listProofs } from "@/lib/proofStore.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const list = await listProofs(status);
  return NextResponse.json({ ok: true, proofs: list });
}
