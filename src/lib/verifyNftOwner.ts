import { SuiClient } from "@mysten/sui/client";

export async function verifyNftOwner(
  client: SuiClient,
  nftObjectId: string,
  wallet: string
): Promise<boolean> {
  try {
    const obj = await client.getObject({
      id: nftObjectId,
      options: { showOwner: true },
    });

    const owner = obj.data?.owner;

    if (
      owner &&
      typeof owner === "object" &&
      "AddressOwner" in owner
    ) {
      return (
        owner.AddressOwner.toLowerCase() ===
        wallet.toLowerCase()
      );
    }

    return false;
  } catch (e) {
    console.error("verifyNftOwner failed", e);
    return false;
  }
}
