import { getActiveMembership } from "@/lib/membershipStore";
import type { MembershipType, User } from "@/context/AuthContext";
import { roleFromMembership } from "@/lib/roleFromMembership";

export async function syncUserMembershipAndRole(user: User): Promise<User> {
  const m = await getActiveMembership(user.id); // mock / on-chain truth
  const type = (m?.type ?? null) as MembershipType;

  const nextRole = roleFromMembership(type, user.role);

  // nếu không đổi gì -> return luôn
  const prevType = user.membership ?? null;
  const prevRole = user.role;

  if (prevType === type && prevRole === nextRole) return user;

  return {
    ...user,
    membership: type,
    role: nextRole,
    // nếu bạn có membershipNftId thì gắn ở đây nếu membershipStore trả về
    membershipNftId: (m as any)?.nftId ?? user.membershipNftId,
  };
}
