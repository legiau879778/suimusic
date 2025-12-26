import { NextResponse } from "next/server";
import { createProof } from "@/lib/proofStore.server";
import { ProofApproval, ProofRecord, ProofTsa } from "@/lib/proofTypes";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustString(v: any, name: string) {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`Missing ${name}`);
  return s;
}

async function requestTsaAttestation(payload: {
  fileHash: string;
  metaHash: string;
  walrusFileId: string;
  walrusMetaId: string;
  timestamp: string;
}): Promise<ProofTsa | null> {
  const endpoint = process.env.TSA_ENDPOINT;
  const apiKey = process.env.TSA_API_KEY;

  if (!endpoint) {
    if (process.env.TSA_MOCK === "1") {
      return {
        id: `mock_tsa_${Date.now()}`,
        signature: "mock_tsa_signature",
        time: new Date().toISOString(),
        mock: true,
      };
    }
    return null;
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return null;

    const id = String(
      data?.id || data?.attestationId || data?.tsaId || ""
    ).trim();
    const signature = String(
      data?.signature || data?.attestationSignature || data?.tsaSignature || ""
    ).trim();
    const time = String(
      data?.time || data?.timestamp || data?.attestationTime || ""
    ).trim();

    if (!id || !signature) return null;

    return {
      id,
      signature,
      time: time || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function buildMockApproval(): ProofApproval {
  return {
    adminWallet: "mock_admin_wallet",
    signature: "mock_approval_signature",
    time: new Date().toISOString(),
    mock: true,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const recordInput: Omit<ProofRecord, "id" | "createdAt"> = {
      status: "submitted",
      authorId: mustString(body?.authorId, "authorId"),
      wallet: mustString(body?.wallet, "wallet"),
      fileHash: mustString(body?.fileHash, "fileHash"),
      metaHash: mustString(body?.metaHash, "metaHash"),
      walrusFileId: mustString(body?.walrusFileId, "walrusFileId"),
      walrusMetaId: mustString(body?.walrusMetaId, "walrusMetaId"),
      walrusCoverId: String(body?.walrusCoverId || "").trim() || undefined,
      message: mustString(body?.message, "message"),
      authorSignature: mustString(body?.authorSignature, "authorSignature"),
      signatureVerified: false,
      signatureVerifyReason: "NOT_VERIFIED",
      metadata: body?.metadata && typeof body.metadata === "object" ? body.metadata : {},
    };

    const msgBytes = new TextEncoder().encode(recordInput.message);
    const isValid = await verifyPersonalMessageSignature(
      msgBytes,
      recordInput.authorSignature,
      { address: recordInput.wallet }
    ).catch(() => false);

    if (!isValid) {
      recordInput.signatureVerified = false;
      recordInput.signatureVerifyReason = "INVALID_SIGNATURE";
      return NextResponse.json(
        { ok: false, error: "Chữ ký tác giả không hợp lệ" },
        { status: 400 }
      );
    }

    recordInput.signatureVerified = true;
    recordInput.signatureVerifyReason = "OK";

    const tsa = await requestTsaAttestation({
      fileHash: recordInput.fileHash,
      metaHash: recordInput.metaHash,
      walrusFileId: recordInput.walrusFileId,
      walrusMetaId: recordInput.walrusMetaId,
      timestamp: new Date().toISOString(),
    });

    if (tsa) {
      recordInput.tsa = tsa;
      recordInput.status = "tsa_attested";
    }

    if (process.env.APPROVAL_MOCK === "1") {
      recordInput.approval = buildMockApproval();
      recordInput.status = "approved";
    }

    const record = await createProof(recordInput);

    return NextResponse.json({ ok: true, proof: record });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 400 }
    );
  }
}
