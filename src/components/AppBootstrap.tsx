"use client";

import { useEffect } from "react";
import { startWorkAuthorAutoSync, syncWorksFromChain } from "@/lib/workStore";

export default function AppBootstrap() {
  useEffect(() => {
    // auto-sync authorName/phone for works when profile changes
    const stop = startWorkAuthorAutoSync();
    // pull on-chain works once so public pages can render data
    syncWorksFromChain();
    return () => stop?.();
  }, []);

  return null;
}
