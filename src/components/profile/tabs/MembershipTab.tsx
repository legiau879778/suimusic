"use client";

import styles from "@/styles/profile.module.css";
import { useAuth } from "@/context/AuthContext";

export default function MembershipPanel() {
  const { user } = useAuth();
  const connected = !!user?.wallet?.address;

  return (
    <>
      {/* HEADER + STATUS */}
      <div className={styles.membershipHeader}>
        <h1>
          Membership music <br />
          <span>Copyright Mode</span>
        </h1>

        <div className={styles.web3Status}>
          <h4>Trạng thái Web3</h4>
          <ul>
            <li>
              Ví SUI network:{" "}
              <strong className={connected ? styles.ok : styles.warn}>
                {connected ? "Đã kết nối" : "Chưa kết nối"}
              </strong>
            </li>
            <li>
              Xác thực On-chain:{" "}
              <strong className={styles.ok}>Hoạt động</strong>
            </li>
            <li>
              Lưu trữ IPFS:{" "}
              <strong className={styles.ok}>Đảm bảo</strong>
            </li>
          </ul>
        </div>
      </div>

      {/* MEMBERSHIP */}
      <div className={styles.membershipGrid}>
        <Card title="Artist Membership" disabled={!connected} />
        <Card title="Creator Membership" disabled={!connected} />
        <Card title="Business Membership" disabled={!connected} />
        <Card title="AI / Platform Membership" disabled={!connected} />
      </div>
    </>
  );
}

function Card({
  title,
  disabled,
}: {
  title: string;
  disabled: boolean;
}) {
  return (
    <div className={styles.membershipCard}>
      <h3>{title}</h3>
      <button className={styles.confirmBtn} disabled={disabled}>
        {disabled ? "KẾT NỐI VÍ TRƯỚC" : "XÁC NHẬN"}
      </button>
    </div>
  );
}
