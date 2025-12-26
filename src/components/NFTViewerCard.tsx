"use client";

import { useEffect, useMemo, useState } from "react";
import type { Work } from "@/lib/workStore";
import { updateNFTOwner } from "@/lib/workStore";
import type { SuiClient } from "@mysten/sui/client";
import { fetchOwnerByObjectId } from "@/lib/nftSync";

type Net = "devnet" | "testnet" | "mainnet";

function short(a?: string) {
  if (!a) return "—";
  return a.slice(0, 6) + "..." + a.slice(-4);
}
function explorerObjUrl(net: Net, objectId: string) {
  return `https://suiexplorer.com/object/${objectId}?network=${net}`;
}
function explorerTxUrl(net: Net, digest: string) {
  return `https://suiexplorer.com/txblock/${digest}?network=${net}`;
}

function toGateway(urlOrId?: string) {
  if (!urlOrId) return "";
  const v = String(urlOrId).trim();
  if (!v) return "";
  if (v.startsWith("http")) return v;
  if (v.startsWith("/api/walrus/blob/")) return v;
  if (v.startsWith("walrus:")) return `/api/walrus/blob/${v.replace("walrus:", "")}`;
  if (v.startsWith("walrus://")) return `/api/walrus/blob/${v.replace("walrus://", "")}`;
  return "";
}

export default function NFTViewerCard(props: {
  work: Work;
  net: Net;
  suiClient: SuiClient;
}) {
  const { work, net, suiClient } = props;

  const [meta, setMeta] = useState<any | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [syncingOwner, setSyncingOwner] = useState(false);

  const metaUrl = useMemo(() => toGateway(work.hash), [work.hash]);

  const previewUrl = useMemo(() => {
    const img = toGateway(meta?.image);
    const anim = toGateway(meta?.animation_url);
    // ưu tiên image
    return img || anim || "";
  }, [meta]);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!metaUrl) {
        setMeta(null);
        return;
      }
      setLoadingMeta(true);
      try {
        const res = await fetch(metaUrl);
        if (!res.ok) throw new Error("Metadata fetch failed");
        const json = await res.json();
        if (alive) setMeta(json);
      } catch {
        if (alive) setMeta(null);
      } finally {
        if (alive) setLoadingMeta(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [metaUrl]);

  async function syncOwner() {
    if (!work.nftObjectId) return;
    setSyncingOwner(true);
    try {
      const owner = await fetchOwnerByObjectId(suiClient, work.nftObjectId);
      if (owner && owner.toLowerCase() !== (work.authorWallet || "").toLowerCase()) {
        updateNFTOwner({ workId: work.id, newOwner: owner });
      }
    } finally {
      setSyncingOwner(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(255,255,255,.03)",
        borderRadius: 18,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,.10)",
            background: "rgba(255,255,255,.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
          }}
        >
          {loadingMeta ? (
            <div style={{ opacity: 0.7, fontSize: 12 }}>Loading…</div>
          ) : previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={work.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ opacity: 0.6, fontSize: 12 }}>No preview</div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{work.title}</div>
          <div style={{ opacity: 0.8, marginTop: 4, fontSize: 13 }}>
            Mode: <b>{work.sellType}</b> • Royalty: <b>{work.royalty ?? 0}%</b>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 13 }}>
            <div>
              <span style={{ opacity: 0.7 }}>Metadata:</span>{" "}
              {metaUrl ? (
                <a href={metaUrl} target="_blank" rel="noreferrer">
                  {work.hash}
                </a>
              ) : (
                "—"
              )}
            </div>

            <div>
              <span style={{ opacity: 0.7 }}>NFT:</span>{" "}
              {work.nftObjectId ? (
                <a href={explorerObjUrl(net, work.nftObjectId)} target="_blank" rel="noreferrer">
                  {short(work.nftObjectId)}
                </a>
              ) : (
                <span style={{ color: "rgba(250,204,21,.9)" }}>Chưa bind NFT (auto-sync sẽ gắn)</span>
              )}
            </div>

            <div>
              <span style={{ opacity: 0.7 }}>Owner:</span> {work.authorWallet ? short(work.authorWallet) : "—"}
              {work.nftObjectId ? (
                <button
                  onClick={syncOwner}
                  disabled={syncingOwner}
                  style={{
                    marginLeft: 10,
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: "rgba(255,255,255,.06)",
                    cursor: syncingOwner ? "not-allowed" : "pointer",
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  {syncingOwner ? "Sync..." : "Sync owner"}
                </button>
              ) : null}
            </div>

            <div>
              <span style={{ opacity: 0.7 }}>Tx:</span>{" "}
              {work.txDigest ? (
                <a href={explorerTxUrl(net, work.txDigest)} target="_blank" rel="noreferrer">
                  {short(work.txDigest)}
                </a>
              ) : (
                "—"
              )}
            </div>
          </div>
        </div>
      </div>

      {meta ? (
        <div style={{ marginTop: 12, opacity: 0.85, fontSize: 13, lineHeight: 1.4 }}>
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Metadata</div>
          <div style={{ opacity: 0.85 }}>{meta?.description || "—"}</div>
        </div>
      ) : null}
    </div>
  );
}
