"use client";

import { useEffect, useRef, useState } from "react";
import { getWorks } from "@/lib/workStore";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import StatusBadge from "@/components/StatusBadge";

export default function ManagePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [works, setWorks] = useState<any[]>([]);
  const lastStatus = useRef<Record<string, string>>(
    {}
  );

  function load() {
    if (!user) return;

    const list = getWorks().filter(
      (w) => w.authorId === user.id
    );

    // detect status change
    list.forEach((w) => {
      const prev = lastStatus.current[w.id];
      if (
        prev &&
        prev !== w.status
      ) {
        if (w.status === "verified") {
          showToast(
            `Tác phẩm "${w.title}" đã được duyệt`,
            "success"
          );
        }
        if (w.status === "rejected") {
          showToast(
            `Tác phẩm "${w.title}" bị từ chối`,
            "warning"
          );
        }
      }
      lastStatus.current[w.id] = w.status;
    });

    setWorks(list);
  }

  useEffect(() => {
    load();
    window.addEventListener("works_updated", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(
        "works_updated",
        load
      );
      window.removeEventListener("storage", load);
    };
  }, [user]);

  return (
    <div style={{ padding: 40 }}>
      <h1>Quản lý tác phẩm</h1>

      {works.map((w) => (
        <div
          key={w.id}
          style={{
            marginTop: 16,
            padding: 16,
            border:
              "1px solid rgba(255,255,255,.08)",
            borderRadius: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <strong>{w.title}</strong>
            <StatusBadge status={w.status} />
          </div>
        </div>
      ))}
    </div>
  );
}
