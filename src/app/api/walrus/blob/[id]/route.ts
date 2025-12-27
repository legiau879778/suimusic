import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOCK_DIR = path.join(
  process.env.WALRUS_MOCK_DIR || process.env.TMPDIR || "/tmp",
  "walrus_mock"
);
function getReadBases() {
  const list: string[] = [];

  const readEnv = process.env.WALRUS_READ_ENDPOINT || "";
  const readList = process.env.WALRUS_READ_ENDPOINTS || "";
  if (readEnv) list.push(readEnv);
  if (readList) {
    list.push(
      ...readList
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    );
  }

  const uploadEnv = process.env.WALRUS_ENDPOINT || "";
  if (uploadEnv.includes("upload-relay")) {
    list.push(uploadEnv.replace("upload-relay", "aggregator"));
  } else if (uploadEnv) {
    list.push(uploadEnv);
  }

  return Array.from(new Set(list));
}

function buildReadCandidates(base: string, id: string) {
  const trimmed = base.replace(/\/+$/, "");
  const list = [
    `${trimmed}/${id}`,
    `${trimmed}/v1/blob/${id}`,
    `${trimmed}/blob/${id}`,
    `${trimmed}/v1/blobs/${id}`,
    `${trimmed}/blobs/${id}`,
  ];
  return Array.from(new Set(list));
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  const READ_BASES = getReadBases();
  if (READ_BASES.length > 0) {
    for (const base of READ_BASES) {
      const candidates = buildReadCandidates(base, id);
      for (const url of candidates) {
        // eslint-disable-next-line no-await-in-loop
        const res = await fetch(url);
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        const contentType = res.headers.get("content-type") || "application/octet-stream";
        return new NextResponse(buf, {
          headers: { "Content-Type": contentType },
        });
      }
    }
  }

  const filePath = path.join(MOCK_DIR, id);
  try {
    const buf = await fs.readFile(filePath);
    return new NextResponse(buf, {
      headers: { "Content-Type": "application/octet-stream" },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
}
