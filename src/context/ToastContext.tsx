"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

export type ToastType =
  | "success"
  | "author"
  | "admin"
  | "warning";

type Toast = {
  id: string;
  message: string;
  type: ToastType;
  undo?: () => void;
  ttl: number; // seconds
};

const ToastContext = createContext<{
  showToast: (
    message: string,
    type?: ToastType,
    undo?: () => void,
    ttl?: number
  ) => void;
}>(null as any);

export function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<Toast[]>(
    []
  );

  function showToast(
    message: string,
    type: ToastType = "success",
    undo?: () => void,
    ttl = 5
  ) {
    const id = crypto.randomUUID();

    setToasts((prev) => [
      ...prev,
      { id, message, type, undo, ttl },
    ]);
  }

  /* COUNTDOWN */
  useEffect(() => {
    const timer = setInterval(() => {
      setToasts((prev) =>
        prev
          .map((t) =>
            t.ttl > 0
              ? { ...t, ttl: t.ttl - 1 }
              : t
          )
          .filter((t) => t.ttl > 0)
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  function undoToast(id: string) {
    setToasts((prev) => {
      const t = prev.find((x) => x.id === id);
      t?.undo?.();
      return prev.filter((x) => x.id !== id);
    });
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div className="toastStack">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast ${t.type}`}
          >
            <ToastIcon type={t.type} />
            <span>{t.message}</span>

            {t.undo && (
              <button
                className="toastUndo"
                onClick={() => undoToast(t.id)}
              >
                Hoàn tác ({t.ttl})
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastIcon({ type }: { type: ToastType }) {
  if (type === "admin") return <span>👑</span>;
  if (type === "author") return <span>✍️</span>;
  if (type === "warning") return <span>⚠️</span>;
  return <span>✓</span>;
}

export const useToast = () =>
  useContext(ToastContext);
