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

function extractAuthorEmail(proof: any) {
  const meta = proof?.metadata || {};
  const candidates = [
    meta?.properties?.author?.email,
    meta?.author?.email,
    meta?.email,
  ];
  for (const c of candidates) {
    const s = String(c || "").trim();
    if (s) return s;
  }
  return "";
}

function extractTitle(proof: any) {
  const meta = proof?.metadata || {};
  return (
    String(meta?.name || meta?.title || "").trim() ||
    "Untitled"
  );
}

async function sendWebhook(payload: Record<string, any>) {
  const url = String(process.env.PROOF_NOTIFY_WEBHOOK || "").trim();
  if (!url) return { ok: false, skipped: true };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, status: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Webhook failed" };
  }
}

async function sendEmail(params: { to: string; subject: string; html: string }) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM_EMAIL || "").trim();
  if (!apiKey || !from) return { ok: false, skipped: true };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });
    return { ok: res.ok, status: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Email failed" };
  }
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

    const url = new URL(req.url);
    const origin = `${url.protocol}//${url.host}`;
    const title = extractTitle(updated);
    const authorEmail =
      String(process.env.PROOF_NOTIFY_EMAIL_OVERRIDE || "").trim() ||
      extractAuthorEmail(updated);
    const metaUrl = updated?.walrusMetaId
      ? `${origin}/api/walrus/blob/${updated.walrusMetaId}`
      : "";

    const payload = {
      proofId: updated.id,
      status: updated.status,
      title,
      authorId: updated.authorId,
      wallet: updated.wallet,
      walrusMetaId: updated.walrusMetaId,
      metaUrl,
      time: new Date().toISOString(),
    };

    const [webhook, email] = await Promise.all([
      sendWebhook({ type: "proof_status", ...payload }),
      authorEmail
        ? sendEmail({
            to: authorEmail,
            subject:
              updated.status === "approved"
                ? "Your proof has been approved"
                : "Your proof has been rejected",
            html:
              updated.status === "approved"
                ? `<p>Your proof is approved.</p><p><b>${title}</b></p>${
                    metaUrl ? `<p>Metadata: <a href="${metaUrl}">${metaUrl}</a></p>` : ""
                  }`
                : `<p>Your proof was rejected.</p><p><b>${title}</b></p>`,
          })
        : Promise.resolve({ ok: false, skipped: true }),
    ]);

    return NextResponse.json({
      ok: true,
      proof: updated,
      notify: {
        webhook: webhook.ok === true,
        email: email.ok === true,
        webhookStatus: "status" in webhook ? webhook.status : undefined,
        emailStatus: "status" in email ? email.status : undefined,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 400 }
    );
  }
}
