"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import { getReviewLogs } from "@/lib/reviewLogStore";
import styles from "@/styles/admin/reviewPanel.module.css";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    setLogs(getReviewLogs());
  }, []);

  return (
    <AdminGuard>
      <h1>Audit Log</h1>

      <div style={{ marginTop: 24 }}>
        {logs.length === 0 && (
          <p style={{ opacity: 0.6 }}>
            Chưa có hoạt động nào
          </p>
        )}

        {logs.map(log => (
          <div
            key={log.id}
            style={{
              padding: 16,
              marginBottom: 12,
              borderRadius: 12,
              border:
                "1px solid rgba(255,255,255,.08)",
              background:
                "rgba(15,23,42,.6)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <strong>{log.workTitle}</strong>
              <span style={{ opacity: 0.6 }}>
                {new Date(log.time).toLocaleString()}
              </span>
            </div>

            <div style={{ marginTop: 6 }}>
              <b>Action:</b>{" "}
              <span
                style={{
                  color:
                    log.action === "approved"
                      ? "#22c55e"
                      : log.action === "rejected"
                      ? "#ef4444"
                      : "#fde047",
                }}
              >
                {log.action}
              </span>
            </div>

            <div style={{ fontSize: 13, opacity: 0.7 }}>
              By: {log.adminEmail} (
              {log.adminRole})
            </div>

            {log.reason && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  opacity: 0.8,
                }}
              >
                Reason: {log.reason}
              </div>
            )}
          </div>
        ))}
      </div>
    </AdminGuard>
  );
}
