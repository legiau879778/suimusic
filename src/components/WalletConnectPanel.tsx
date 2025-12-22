"use client";

import { useEffect, useState } from "react";
import {
  useCurrentAccount,
  useConnectWallet,
  useDisconnectWallet,
} from "@mysten/dapp-kit";

import { useAuth } from "@/context/AuthContext";
import {
  getWalletsByEmail,
  mapWalletToEmail,
  revokeWallet,
} from "@/lib/walletMapStore";

import styles from "@/styles/wallet.module.css";

export default function WalletConnectPanel() {
  const { user } = useAuth();
  const account = useCurrentAccount();
  const { mutate: connect } = useConnectWallet();
  const { mutate: disconnect } = useDisconnectWallet();

  const [mappedWallets, setMappedWallets] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    setMappedWallets(getWalletsByEmail(user.email));
  }, [user]);

  const isConnected =
    account &&
    mappedWallets.includes(account.address);

  return (
    <div className={styles.card}>
      <h3>🔗 Kết nối ví Blockchain (SUI)</h3>

      {/* GOOGLE */}
      <div className={styles.row}>
        <i className="fab fa-google" />
        <span>{user?.email}</span>
        <span className={styles.ok}>Đã kết nối</span>
      </div>

      {/* WALLET */}
      <div className={styles.row}>
        <i className="fas fa-wallet" />
        {account ? (
          <>
            <span className={styles.addr}>
              {account.address.slice(0, 6)}...
              {account.address.slice(-4)}
            </span>

            {isConnected ? (
              <button
                className={styles.revoke}
                onClick={() => {
                  revokeWallet(
                    user!.email,
                    account.address
                  );
                  setMappedWallets(
                    getWalletsByEmail(user!.email)
                  );
                }}
              >
                Revoke
              </button>
            ) : (
              <button
                className={styles.map}
                onClick={() => {
                  mapWalletToEmail(
                    user!.email,
                    account.address
                  );
                  setMappedWallets(
                    getWalletsByEmail(user!.email)
                  );
                }}
              >
                Lưu ví
              </button>
            )}
          </>
        ) : (
          <button
            className={styles.connect}
            onClick={() => connect()}
          >
            Kết nối ví
          </button>
        )}
      </div>

      {/* DISCONNECT */}
      {account && (
        <button
          className={styles.disconnect}
          onClick={() => disconnect()}
        >
          Ngắt kết nối ví
        </button>
      )}
    </div>
  );
}
