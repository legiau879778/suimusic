import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOCK_DIR = path.join(process.cwd(), "data", "walrus_mock");

function sha256Hex(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function pickBlobId(data: any) {
  return (
    data?.blobId ||
    data?.id ||
    data?.blob_id ||
    data?.objectId ||
    data?.object_id ||
    null
  );
}

function pickUrl(data: any) {
  return data?.url || data?.uri || data?.blobUrl || null;
}

function appendQuery(url: string, key: string, value: string) {
  if (!value) return url;
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function buildUploadCandidates(endpoint: string, epochs?: string) {
  const base = endpoint.replace(/\/+$/, "");
  const list = [endpoint];
  if (!base.includes("/v1/") && !base.endsWith("/store")) {
    list.push(`${base}/v1/store`, `${base}/store`);
  }
  const withQuery = list.map((u) => appendQuery(u, "epochs", epochs || ""));
  return Array.from(new Set(withQuery));
}

async function storeMock(buf: Buffer) {
  const id = sha256Hex(buf);
  await fs.mkdir(MOCK_DIR, { recursive: true });
  await fs.writeFile(path.join(MOCK_DIR, id), buf);
  return { id, url: `/api/walrus/blob/${id}` };
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint = process.env.WALRUS_JSON_ENDPOINT || process.env.WALRUS_ENDPOINT;
  const apiKey = process.env.WALRUS_API_KEY;
  const useMock = !endpoint || process.env.WALRUS_MOCK === "1";

  if (useMock) {
    const buf = Buffer.from(JSON.stringify(body));
    const mock = await storeMock(buf);
    return NextResponse.json({
      ok: true,
      blobId: mock.id,
      url: mock.url,
      mock: true,
    });
  }

  const candidates = buildUploadCandidates(
    endpoint as string,
    process.env.WALRUS_STORE_EPOCHS
  );

  let res: Response | null = null;
  let text = "";
  let lastErr = "";

  const payload = JSON.stringify(body);
  const file = new File([Buffer.from(payload)], "metadata.json", {
    type: "application/json",
  });

  const fd = new FormData();
  fd.append("file", file, "metadata.json");

  for (const url of candidates) {
    // eslint-disable-next-line no-await-in-loop
    res = await fetch(url, {
      method: "POST",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      body: fd,
    });
    // eslint-disable-next-line no-await-in-loop
    text = await res.text();
    if (res.ok) break;
    if (res.status !== 404 && res.status !== 405) {
      return NextResponse.json(
        { ok: false, error: text || `HTTP ${res.status}` },
        { status: 500 }
      );
    }
    lastErr = text || `HTTP ${res.status}`;
  }

  if (!res || !res.ok) {
    return NextResponse.json(
      { ok: false, error: lastErr || "Walrus upload failed" },
      { status: 500 }
    );
  }

  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid Walrus response" },
      { status: 500 }
    );
  }

  const blobId = pickBlobId(json);
  const url = pickUrl(json);

  if (!blobId) {
    return NextResponse.json(
      { ok: false, error: "Walrus response missing blob id" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, blobId, url });
}
