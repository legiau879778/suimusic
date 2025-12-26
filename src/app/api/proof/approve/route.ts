import { NextResponse } from "next/server";
import { updateProof } from "@/lib/proofStore.server";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustString(v: any, name: string) {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`Missing ${name}`);
  return s;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const proofId = mustString(body?.proofId, "proofId");
    const isReject = Boolean(body?.reject);
    const adminWallet = mustString(body?.adminWallet, "adminWallet");
    const signature = mustString(body?.signature, "signature");
    const message = mustString(body?.message, "message");

    const allow = String(process.env.ADMIN_WALLET_ALLOWLIST || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    if (allow.length && adminWallet && !allow.includes(adminWallet.toLowerCase())) {
      return NextResponse.json(
        { ok: false, error: "Admin wallet không nằm trong allowlist" },
        { status: 403 }
      );
    }

    const msgBytes = new TextEncoder().encode(message);
    const ok = await verifyPersonalMessageSignature(msgBytes, signature, {
      address: adminWallet,
    }).catch(() => false);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "Chữ ký admin không hợp lệ" },
        { status: 400 }
      );
    }

    const updated = await updateProof(proofId, {
      approval: isReject
        ? undefined
        : {
            adminWallet,
            signature,
            time: new Date().toISOString(),
          },
      status: isReject ? "rejected" : "approved",
    });

    if (!updated) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, proof: updated });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 400 }
    );
  }
}
