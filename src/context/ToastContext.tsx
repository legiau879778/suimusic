"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

type ToastType = "success" | "error" | "info" | "warning" | "admin";

export type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
};

type ToastCtx = {
  // ✅ chuẩn: pushToast(type, message)
  pushToast: (type: ToastType, message: string, duration?: number) => void;

  // ✅ legacy: toast(type, message)
  toast: (type: ToastType, message: string, duration?: number) => void;

  // ✅ legacy: showToast(message, type)  (bạn đang dùng trong AuthContext)
  showToast: (message: string, type?: ToastType, duration?: number) => void;
};

const ToastContext = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const pushToast = (type: ToastType, message: string, duration = 2400) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now() + Math.random());

    const t: ToastItem = { id, type, message, duration };
    setItems((prev) => [...prev, t]);

    window.setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, duration);
  };

  // ✅ showToast(message, type)
  const showToast = (message: string, type: ToastType = "info", duration?: number) => {
    pushToast(type, message, duration);
  };

  const value = useMemo(
    () => ({
      pushToast,
      toast: pushToast,
      showToast,
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 9999,
        }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            style={{
              minWidth: 240,
              maxWidth: 360,
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(250,204,21,.18)",
              background: "rgba(15,23,42,.92)",
              color: "#e5e7eb",
              boxShadow: "0 18px 40px rgba(0,0,0,.35)",
              fontSize: 13,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                background:
                  t.type === "success"
                    ? "rgba(34,197,94,.9)"
                    : t.type === "error"
                    ? "rgba(248,113,113,.9)"
                    : t.type === "warning"
                    ? "rgba(250,204,21,.95)"
                    : t.type === "admin"
                    ? "rgba(167,139,250,.95)"
                    : "rgba(56,189,248,.9)",
              }}
            />
            <span style={{ lineHeight: 1.25 }}>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
