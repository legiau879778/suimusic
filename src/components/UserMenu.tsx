"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user || !user.name) return null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "#facc15",
          color: "#020617",
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        {user.name.charAt(0).toUpperCase()}
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 46,
            background: "#020617",
            border: "1px solid rgba(148,163,184,.2)",
            borderRadius: 14,
            padding: 12,
            minWidth: 160,
          }}
        >
          <div
            style={{ padding: 8, cursor: "pointer" }}
            onClick={() => router.push("/profile")}
          >
            Hồ sơ
          </div>
          <div
            style={{ padding: 8, cursor: "pointer" }}
            onClick={logout}
          >
            Đăng xuất
          </div>
        </div>
      )}
    </div>
  );
}
