"use client";

import { useEffect, useState } from "react";
import { getHistoryByWallet } from "@/lib/blockchainHistory";
import { getCurrentUser } from "@/lib/authStore";
import { getActiveAdminWallet } from "@/lib/adminWalletStore";

export default function ProfileHistoryPage() {
  const user = getCurrentUser();
  const wallet =
    user && getActiveAdminWallet(user.email);

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet) return;

    setLoading(true);
    getHistoryByWallet(wallet.address)
      .then(setData)
      .finally(() => setLoading(false));
  }, [wallet?.address]);

  if (!wallet) {
    return (
      <p>
        Vui lòng kết nối wallet để xem lịch sử giao dịch
      </p>
    );
  }

  if (loading) {
    return <p>Đang tải dữ liệu từ blockchain…</p>;
  }

  return (
    <>
      <h2>Lịch sử giao dịch (On-chain)</h2>

      <table style={{ width: "100%", marginTop: 20 }}>
        <thead>
          <tr>
            <th>Thời gian</th>
            <th>Tác phẩm</th>
            <th>Hành động</th>
            <th>Giá / Phí</th>
            <th>Giao dịch</th>
          </tr>
        </thead>
        <tbody>
          {data.map((x, i) => (
            <tr key={i}>
              <td>
                {new Date(x.time * 1000).toLocaleString()}
              </td>
              <td>{x.workId}</td>
              <td>{x.type}</td>
              <td>{x.amountEth} ETH</td>
              <td>
                <a
                  href={`${process.env.NEXT_PUBLIC_BLOCK_EXPLORER}/tx/${x.txHash}`}
                  target="_blank"
                >
                  Xem
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
