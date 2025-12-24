import { NextResponse } from "next/server";
import { SuiClient } from "@mysten/sui.js/client";

const client = new SuiClient({
  url: "https://fullnode.mainnet.sui.io",
});

export async function POST(req: Request) {
  const { wallet, nftObjectId, licenses } =
    await req.json();

  if (!wallet) {
    return NextResponse.json(
      { ok: false },
      { status: 401 }
    );
  }

  /* 1️⃣ Check NFT ownership */
  const obj = await client.getObject({
    id: nftObjectId,
    options: { showOwner: true },
  });

  const owner =
    (obj.data?.owner as any)?.AddressOwner;

  if (owner === wallet) {
    return NextResponse.json({ ok: true });
  }

  /* 2️⃣ Check license */
  const licensed = licenses?.some(
    (l: any) =>
      l.licensee.toLowerCase() ===
      wallet.toLowerCase()
  );

  if (licensed) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { ok: false },
    { status: 403 }
  );
}
