"use client";

import { useState } from "react";
import styles from "@/styles/trade.module.css";
import { getWorks, syncTradeSuccess } from "@/lib/workStore";
import { useSession } from "next-auth/react";
import { getCurrentUser } from "@/lib/authStore";
import { getActiveAdminWallet } from "@/lib/adminWalletStore";
import { ethers } from "ethers";
import { getContract } from "@/lib/contract";

type TxState = "idle" | "signing" | "pending" | "success" | "error";

export default function TradePage() {
  const works = getWorks().filter(
    w => w.marketStatus === "tradeable"
  );

  const { data: session } = useSession();
  const user = getCurrentUser();
  const wallet =
    user && getActiveAdminWallet(user.email);

  const [selected, setSelected] = useState<any>(null);
  const [txState, setTxState] = useState<TxState>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState("");

  const hasBought = (work: any) => {
    if (!wallet) return false;
    return work.onchainTrades?.some(
      (t: any) =>
        t.buyer.toLowerCase() === wallet.address.toLowerCase()
    );
  };

  async function confirmBuy() {
    try {
      setTxState("signing");

      const provider = new ethers.BrowserProvider(
        (window as any).ethereum
      );
      const signer = await provider.getSigner();

      const contract = await getContract();
      const signed = contract.connect(signer);

      const tx = await signed.tradeWork(selected.id, {
        value: ethers.parseEther("0.1"),
      });

      setTxHash(tx.hash);
      setTxState("pending");

      await tx.wait();

      // ✅ SYNC OFF-CHAIN
      syncTradeSuccess(
        selected.id,
        wallet!.address,
        tx.hash
      );

      setTxState("success");
    } catch (e: any) {
      setError(e.message || "Transaction failed");
      setTxState("error");
    }
  }

  return (
    <div className={styles.page}>
      <h1>Giao dịch bản quyền</h1>

      <div className={styles.grid}>
        {works.map(w => (
          <div key={w.id} className={styles.card}>
            <h3>{w.title}</h3>
            <p>Owner: {w.authorId}</p>

            <div className={styles.price}>0.1 ETH</div>

            <button
              className={styles.buy}
              disabled={
                !session ||
                !wallet ||
                hasBought(w)
              }
              onClick={() => setSelected(w)}
            >
              {!session
                ? "Đăng nhập để mua"
                : !wallet
                ? "Kết nối wallet"
                : hasBought(w)
                ? "Đã mua"
                : "Mua bản quyền"}
            </button>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {selected && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Xác nhận giao dịch</h3>
            <p><strong>{selected.title}</strong></p>

            {txState === "idle" && (
              <button
                className={styles.confirm}
                onClick={confirmBuy}
              >
                Xác nhận & ký
              </button>
            )}

            {txState === "signing" && <p>🦊 Chờ ký…</p>}
            {txState === "pending" && (
              <p>
                ⏳ Đang xử lý…
                <br />
                <a
                  href={`${process.env.NEXT_PUBLIC_BLOCK_EXPLORER}/tx/${txHash}`}
                  target="_blank"
                >
                  Xem tx
                </a>
              </p>
            )}

            {txState === "success" && (
              <p className={styles.success}>✅ Thành công</p>
            )}

            {txState === "error" && (
              <p className={styles.error}>{error}</p>
            )}

            <button
              className={styles.cancel}
              onClick={() => {
                setSelected(null);
                setTxState("idle");
                setTxHash(null);
                setError("");
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
