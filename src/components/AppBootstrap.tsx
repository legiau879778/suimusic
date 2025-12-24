"use client";

import { useEffect } from "react";
import { startWorkAuthorAutoSync } from "@/lib/workStore";

export default function AppBootstrap() {
  useEffect(() => {
    // auto-sync authorName/phone for works when profile changes
    const stop = startWorkAuthorAutoSync();
    return () => stop?.();
  }, []);

  return null;
}
