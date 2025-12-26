"use client";

import { useEffect, useState } from "react";
import type { Membership } from "@/lib/membershipStore";
import { getActiveMembership, getCachedMembership } from "@/lib/membershipStore";

export function useUserMembership(userId: string, email?: string) {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!userId) {
        setMembership(null);
        return;
      }
      const mail = String(email || "").trim();
      if (!mail) {
        setMembership(null);
        return;
      }
      setLoading(true);
      try {
        const cached = getCachedMembership(userId, mail);
        if (alive && cached) setMembership(cached);
        const m = await getActiveMembership({ userId, email: mail });
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
    const mail = String(email || "").trim();
    if (!userId || !mail) return;
    const m = await getActiveMembership({ userId, email: mail });
    setMembership(m);
  }};
}
