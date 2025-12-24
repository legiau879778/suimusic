import { SuiClient } from "@mysten/sui/client";
import { getFullnodeUrl } from "@mysten/sui/client";

export const suiClient = new SuiClient({
  url: getFullnodeUrl("devnet"),
});
