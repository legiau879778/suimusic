"use client";

import { useEffect, useState } from "react";
import type { Membership } from "@/lib/membershipStore";
import { getActiveMembership } from "@/lib/membershipStore";

export function useUserMembership(userId: string) {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!userId) {
        setMembership(null);
        return;
      }
      setLoading(true);
      try {
        const m = await getActiveMembership(userId);
        if (alive) setMembership(m);
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [userId]);

  return { membership, loading, refresh: async () => {
    if (!userId) return;
    const m = await getActiveMembership(userId);
    setMembership(m);
  }};
}
