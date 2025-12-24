"use client";

import { useMemo, useState } from "react";
import { explorerTxUrl, shortAddr } from "@/lib/suiExplorer";
import { getRoyaltyStats } from "@/lib/workStore";

function HelpTip({ text }: { text: string }) {
  return (
    <span
      title={text}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        cursor: "help",
        background: "rgba(250,204,21,.18)",
        border: "1px solid rgba(250,204,21,.25)",
        color: "#facc15",
        marginLeft: 6,
      }}
    >
      ?
    </span>
  );
}

export default function RoyaltyPanel({ work }: { work: any }) {
  const [revenue, setRevenue] = useState<number>(100);

  const stats = useMemo(() => getRoyaltyStats(work.id), [work.id, work.licenses?.length]);

  const licenses = work.licenses ?? [];

  // ✅ ưu tiên royalty lưu trong work (mirror on-chain), nếu không có thì fallback avg royalty từ licenses
  const royaltyPercent =
    typeof work.royalty === "number"
      ? work.royalty
      : (stats?.avgRoyalty ?? 0);

  const estimatedPayout = useMemo(() => {
    return Math.round(revenue * (royaltyPercent / 100) * 100) / 100;
  }, [revenue, royaltyPercent]);

  const meaning =
    `Royalty là % doanh thu mà chủ sở hữu tác phẩm nhận được khi có giao dịch liên quan đến tác phẩm.\n\n` +
    `• Với LICENSE: mỗi lần cấp license, royalty thường là % doanh thu/giá license.\n` +
    `• Với EXCLUSIVE SELL: royalty có thể dùng để chia tiền cho tác giả gốc (nếu contract hỗ trợ).\n\n` +
    `Ví dụ: royalty = 10%, doanh thu 100 → payout = 10.`;

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.12)",
        borderRadius: 16,
        padding: 14,
        background: "rgba(255,255,255,.03)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900 }}>
          Royalty
          <HelpTip text={meaning} />
        </h3>

        <span
          style={{
            fontSize: 12,
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(148,163,184,.22)",
            background: "rgba(148,163,184,.10)",
            opacity: 0.95,
          }}
        >
          Mode: {work.sellType}
        </span>
      </div>

      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        <div>
          <b>Royalty %:</b> {royaltyPercent}%
        </div>

        {work.sellType === "license" && (
          <>
            <div>
              <b>Total licenses:</b> {stats?.totalLicenses ?? 0}
            </div>
            <div style={{ opacity: 0.75, fontSize: 12 }}>
              * Nếu bạn chưa lưu royalty trong work, panel sẽ lấy trung bình từ lịch sử license.
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
          <span style={{ opacity: 0.9 }}>Doanh thu giả lập:</span>
          <input
            type="number"
            value={revenue}
            onChange={e => setRevenue(Number(e.target.value || 0))}
            style={{
              padding: 8,
              borderRadius: 10,
              width: 120,
              background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.14)",
              color: "#e5e7eb",
              outline: "none",
            }}
          />
          <span style={{ opacity: 0.9 }}>→ Payout ước tính:</span>
          <b>{estimatedPayout}</b>
        </div>

        {work.sellType === "license" && (
          <>
            <hr style={{ opacity: 0.2, margin: "10px 0" }} />
            <div style={{ fontWeight: 900, marginBottom: 6 }}>License history</div>

            {licenses.length === 0 ? (
              <div style={{ opacity: 0.7 }}>Chưa có license nào</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {licenses.slice().reverse().map((l: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: 10,
                      borderRadius: 12,
                      background: "rgba(255,255,255,.04)",
                      border: "1px solid rgba(255,255,255,.08)",
                    }}
                  >
                    <div>
                      <div>
                        <b>Licensee:</b> {shortAddr(l.licensee)}
                      </div>
                      <div style={{ opacity: 0.8, fontSize: 12 }}>
                        {new Date(l.issuedAt).toLocaleString()}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div>
                        <b>{l.royalty}%</b>
                      </div>
                      <a
                        href={explorerTxUrl(l.txDigest)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12, textDecoration: "underline", opacity: 0.85 }}
                      >
                        tx
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
