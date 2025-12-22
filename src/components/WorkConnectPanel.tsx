"use client";

import styles from "@/styles/walletConnectPanel.module.css";
import { useAuth } from "@/context/AuthContext";

export default function WalletConnectPanel() {
  const { user, connectWallet } = useAuth();

  if (!user) return null;

  return (
    <div className={styles.panel}>
      <h3>Ví SUI</h3>

      {!user.wallet ? (
        <button
          className={styles.connect}
          onClick={connectWallet}   // ✅ ĐÚNG chữ ký
        >
          Kết nối ví
        </button>
      ) : (
        <div className={styles.connected}>
          <div className={styles.field}>
            <label>Địa chỉ ví</label>
            <input
              value={user.wallet.address}
              disabled
            />
          </div>

          <p className={styles.status}>
            ✅ Ví đã xác thực
          </p>
        </div>
      )}
    </div>
  );
}
