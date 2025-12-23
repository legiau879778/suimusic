import { loadUser, saveUser } from "@/lib/authStorage";

export async function mintMembership({
  wallet,
  type,
}: {
  wallet: string;
  type: string;
}) {
  const res = await fetch("/api/membership/mint", {
    method: "POST",
    body: JSON.stringify({ wallet, type }),
  });

  const data = await res.json();

  const user = loadUser();
  if (!user) return;

  const updated = {
    ...user,
    membership: data.type,
    membershipNftId: data.nftId,
  };

  saveUser(updated);
}
