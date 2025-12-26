import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ") && auth.slice(7) === secret) return true;

  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const net = url.searchParams.get("network") || process.env.NEXT_PUBLIC_SUI_NETWORK || "devnet";

  const origin = `${url.protocol}//${url.host}`;
  const target = `${origin}/api/chainstorm/works?network=${encodeURIComponent(net)}&force=1`;

  try {
    const res = await fetch(target, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error || "Sync failed" },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      network: net,
      cachedAt: data?.cachedAt || null,
      count: Array.isArray(data?.works) ? data.works.length : 0,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Sync failed" },
      { status: 500 }
    );
  }
}
