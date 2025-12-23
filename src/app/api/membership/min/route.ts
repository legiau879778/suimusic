import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { wallet, type } = await req.json();

  // TODO: thay bằng SUI SDK mint thật
  const fakeNftId = `SUI-NFT-${type}-${Date.now()}`;

  return NextResponse.json({
    nftId: fakeNftId,
    type,
  });
}
