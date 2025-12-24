"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import { getWorks, updateNFTOwner } from "@/lib/workStore";
import { useSuiClient } from "@mysten/dapp-kit";
import { explorerObjectUrl, explorerTxUrl, shortAddr } from "@/lib/suiExplorer";

export default function AdminNFTDashboard() {
  const suiClient = useSuiClient();
  const [rows, setRows] = useState<any[]>([]);

  function load() {
    setRows(getWorks());
  }

  useEffect(() => {
    load();
    window.addEventListener("works_updated", load);
    return () => window.removeEventListener("works_updated", load);
  }, []);

  async function syncAll() {
    for (const w of rows) {
      if (!w.nftObjectId) continue;

      try {
        const obj = await suiClient.getObject({
          id: w.nftObjectId,
          options: { showOwner: true },
        });

        const owner = (obj.data?.owner as any)?.AddressOwner;
        if (owner) updateNFTOwner({ workId: w.id, newOwner: owner });
      } catch (e) {
        console.error("sync failed", w.nftObjectId, e);
      }
    }
  }

  return (
    <AdminGuard>
      <div style={{ padding: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1>Admin NFT Dashboard</h1>
            <p style={{ opacity: 0.75 }}>Theo dõi NFT object + owner + tx</p>
          </div>

          <button
            onClick={syncAll}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(250,204,21,.9)",
              fontWeight: 900,
            }}
          >
            Sync all owners
          </button>
        </div>

        <div style={{ marginTop: 16, border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "rgba(255,255,255,.06)" }}>
              <tr>
                <th style={th}>Title</th>
                <th style={th}>Status</th>
                <th style={th}>SellType</th>
                <th style={th}>NFT</th>
                <th style={th}>Owner</th>
                <th style={th}>Tx</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(w => (
                <tr key={w.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                  <td style={td}>{w.title}</td>
                  <td style={td}>{w.status}</td>
                  <td style={td}>{w.sellType}</td>
                  <td style={td}>
                    {w.nftObjectId ? (
                      <a href={explorerObjectUrl(w.nftObjectId)} target="_blank" rel="noreferrer">
                        {shortAddr(w.nftObjectId)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={td}>{shortAddr(w.authorWallet)}</td>
                  <td style={td}>
                    {w.txDigest ? (
                      <a href={explorerTxUrl(w.txDigest)} target="_blank" rel="noreferrer">
                        {shortAddr(w.txDigest)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminGuard>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  fontSize: 12,
  opacity: 0.85,
};

const td: React.CSSProperties = {
  padding: 12,
  fontSize: 13,
};
