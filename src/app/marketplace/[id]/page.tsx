"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { bindLicenseToWork, getWorkById, updateNFTOwner } from "@/lib/workStore";
import { useToast } from "@/context/ToastContext";

/* ===== SUI SDK (NEW) ===== */
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientContext,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";

/* ✅ CONFIG (network-aware) */
import { getChainstormConfig, normalizeSuiNet } from "@/lib/chainstormConfig";

/* ================= HELPERS ================= */

function shortAddr(a?: string) {
  if (!a) return "—";
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function explorerTxUrl(net: "devnet" | "testnet" | "mainnet", digest: string) {
  return `https://suiexplorer.com/txblock/${digest}?network=${net}`;
}

function explorerObjUrl(net: "devnet" | "testnet" | "mainnet", objectId: string) {
  return `https://suiexplorer.com/object/${objectId}?network=${net}`;
}

async function fetchObjectOwnerAddress(suiClient: any, objectId: string): Promise<string | null> {
  const obj = await suiClient.getObject({
    id: objectId,
    options: { showOwner: true },
  });

  const owner = obj?.data?.owner;
  if (!owner) return null;
  if (owner.AddressOwner) return owner.AddressOwner as string;
  return null;
}

/* ================= COMPONENT ================= */

export default function MarketplaceDetailPage() {
  const params = useParams<{ id: string }>();
  const workId = params?.id;
  const router = useRouter();
  const { showToast } = useToast();

  const suiClient = useSuiClient();
  const suiCtx = useSuiClientContext();
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();

  // ✅ same network detection as register-work
  const activeNet = normalizeSuiNet(suiCtx?.network);
  const cfg = getChainstormConfig(activeNet);

  const PACKAGE_ID = cfg?.packageId || "";
  const MODULE = cfg?.module || "chainstorm_nft";
  const ISSUE_LICENSE_FN = "issue_license"; // Move fn name in your module

  const [work, setWork] = useState<any | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [buying, setBuying] = useState(false);

  // ✅ IMPORTANT: Hook must be called every render (not after early return)
  const licenses = useMemo(() => work?.licenses ?? [], [work?.licenses]);

  /* ================= LOAD WORK ================= */

  useEffect(() => {
    if (!workId) return;
    const w = getWorkById(workId);
    if (!w) {
      router.replace("/marketplace");
      return;
    }
    setWork(w);
  }, [workId, router]);

  /* ================= SYNC OWNER ================= */

  async function syncOwner() {
    if (!work?.nftObjectId) return;
    setSyncing(true);
    try {
      const owner = await fetchObjectOwnerAddress(suiClient, work.nftObjectId);
      if (owner && owner.toLowerCase() !== (work.authorWallet || "").toLowerCase()) {
        updateNFTOwner({ workId: work.id, newOwner: owner });
        setWork((prev: any) => ({ ...prev, authorWallet: owner }));
      }
    } catch (e) {
      console.error(e);
      showToast("Unable to read owner from chain", "warning");
    } finally {
      setSyncing(false);
    }
  }

  // poll owner every 10s
  useEffect(() => {
    if (!work?.nftObjectId) return;
    const t = setInterval(syncOwner, 10_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [work?.nftObjectId, work?.id]);

  /* ================= BUY LICENSE ================= */

  async function buyLicense() {
    if (!work) return;

    if (!currentAccount) {
      showToast("Connect a wallet to buy a license", "warning");
      return;
    }

    if (!PACKAGE_ID?.startsWith("0x")) {
      showToast(`Missing packageId for network ${activeNet}`, "error");
      return;
    }

    if (work.sellType !== "license") {
      showToast("This work is not sold as a license", "warning");
      return;
    }

    if (!work.nftObjectId) {
      showToast("This work does not have a WorkNFT", "error");
      return;
    }

    const royalty = typeof work.royalty === "number" ? work.royalty : 10;

    try {
      setBuying(true);
      showToast("Creating license purchase transaction...", "info");

      const tx = new Transaction();

      // Move: issue_license(work_id: address, licensee: address, royalty: u8, ctx)
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::${ISSUE_LICENSE_FN}`,
        arguments: [
          tx.pure.address(work.nftObjectId),
          tx.pure.address(currentAccount.address),
          tx.pure.u8(Math.floor(royalty)),
        ],
      });

      const result = await signAndExecuteTransaction({
        transaction: tx,
      });

      bindLicenseToWork({
        workId: work.id,
        licensee: currentAccount.address,
        royalty,
        txDigest: result.digest,
      });

      // update local UI
      setWork((prev: any) => ({
        ...prev,
        licenses: [
          ...(prev.licenses ?? []),
          {
            licensee: currentAccount.address,
            royalty,
            txDigest: result.digest,
            issuedAt: new Date().toISOString(),
          },
        ],
      }));

      showToast("License purchase successful", "success");
    } catch (e) {
      console.error(e);
      showToast("License purchase failed", "error");
    } finally {
      setBuying(false);
    }
  }

  /* ================= RENDER ================= */

  if (!work) {
    return (
      <main style={{ padding: 28, maxWidth: 900, margin: "0 auto", opacity: 0.8 }}>
        Loading...
      </main>
    );
  }

  return (
    <main style={{ padding: 28, maxWidth: 900, margin: "0 auto" }}>
      <div
        style={{
          border: "1px solid rgba(255,255,255,.10)",
          borderRadius: 18,
          padding: 18,
          background: "rgba(255,255,255,.03)",
        }}
      >
        <h1>{work.title}</h1>

        <p style={{ opacity: 0.8, marginTop: 6 }}>
          Network: <b>{activeNet}</b> • pkg: <b>{shortAddr(PACKAGE_ID)}</b>
          {syncing ? <span style={{ marginLeft: 10, opacity: 0.7 }}>syncing...</span> : null}
        </p>

        <p>
          <b>Mode:</b> {work.sellType}
        </p>

        <p>
          <b>NFT:</b>{" "}
          {work.nftObjectId ? (
            <a href={explorerObjUrl(activeNet, work.nftObjectId)} target="_blank" rel="noreferrer">
              {shortAddr(work.nftObjectId)}
            </a>
          ) : (
            "Not minted"
          )}
        </p>

        <p>
          <b>Owner:</b> {work.authorWallet ? shortAddr(work.authorWallet) : "—"}
        </p>

        {work.sellType === "license" && (
          <>
            <hr style={{ opacity: 0.2, margin: "14px 0" }} />

            <button
              onClick={buyLicense}
              disabled={buying || isPending}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(250,204,21,.28)",
                background: "rgba(250,204,21,.16)",
                fontWeight: 900,
                cursor: buying || isPending ? "not-allowed" : "pointer",
                opacity: buying || isPending ? 0.7 : 1,
              }}
            >
              {buying ? "Purchasing..." : "Buy license"}
            </button>

            <h3 style={{ marginTop: 20 }}>License history</h3>

            {licenses.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No licenses yet.</div>
            ) : (
              licenses
                .slice()
                .reverse()
                .map((l: any, idx: number) => (
                  <div key={idx} style={{ marginTop: 10 }}>
                    <div>
                      <b>Licensee:</b> {shortAddr(l.licensee)}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {new Date(l.issuedAt).toLocaleString()}
                    </div>
                    <a
                      href={explorerTxUrl(activeNet, l.txDigest)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12 }}
                    >
                      tx
                    </a>
                  </div>
                ))
            )}
          </>
        )}
      </div>
    </main>
  );
}
