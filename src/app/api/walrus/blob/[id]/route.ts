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

function parseRange(rangeHeader: string, size: number) {
  const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (!m) return null;
  const startStr = m[1];
  const endStr = m[2];

  let start = 0;
  let end = size - 1;

  if (startStr === "" && endStr === "") return null;
  if (startStr === "") {
    const last = Number(endStr);
    if (!Number.isFinite(last) || last <= 0) return null;
    start = Math.max(0, size - last);
  } else {
    start = Number(startStr);
  }
  if (endStr !== "") {
    end = Number(endStr);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < start) return null;
  if (start >= size) return null;
  end = Math.min(end, size - 1);

  return { start, end };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  const READ_BASES = getReadBases();
  const rangeHeader = req.headers.get("range") || "";

  if (READ_BASES.length > 0) {
    for (const base of READ_BASES) {
      const candidates = buildReadCandidates(base, id);
      for (const url of candidates) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const res = await fetch(url, {
            headers: rangeHeader ? { Range: rangeHeader } : undefined,
          });
          if (!res.ok) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          const contentType = res.headers.get("content-type") || "application/octet-stream";
          const size = buf.length;

          if (rangeHeader && res.status === 206) {
            return new NextResponse(buf, {
              status: 206,
              headers: {
                "Content-Type": contentType,
                "Content-Length": String(size),
                "Content-Range": res.headers.get("content-range") || "",
                "Accept-Ranges": "bytes",
              },
            });
          }

          if (rangeHeader) {
            const range = parseRange(rangeHeader, size);
            if (range) {
              const chunk = buf.subarray(range.start, range.end + 1);
              return new NextResponse(chunk, {
                status: 206,
                headers: {
                  "Content-Type": contentType,
                  "Content-Length": String(chunk.length),
                  "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
                  "Accept-Ranges": "bytes",
                },
              });
            }
          }

          return new NextResponse(buf, {
            headers: { "Content-Type": contentType, "Accept-Ranges": "bytes" },
          });
        } catch {
          // ignore network errors and fall through to next candidate/mock
        }
      }
    }
  }

  const filePath = path.join(MOCK_DIR, id);
  try {
    const buf = await fs.readFile(filePath);
    const size = buf.length;
    if (rangeHeader) {
      const range = parseRange(rangeHeader, size);
      if (range) {
        const chunk = buf.subarray(range.start, range.end + 1);
        return new NextResponse(chunk, {
          status: 206,
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Length": String(chunk.length),
            "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
            "Accept-Ranges": "bytes",
          },
        });
      }
    }
    return new NextResponse(buf, {
      headers: { "Content-Type": "application/octet-stream", "Accept-Ranges": "bytes" },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
}
