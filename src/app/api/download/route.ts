import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { ok, ipfsUrl } = await req.json();

  if (!ok) {
    return NextResponse.json(
      { error: "FORBIDDEN" },
      { status: 403 }
    );
  }

  // proxy file (không lộ CID trực tiếp)
  const file = await fetch(ipfsUrl);
  const buffer = await file.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition":
        "attachment; filename=work.bin",
    },
  });
}
