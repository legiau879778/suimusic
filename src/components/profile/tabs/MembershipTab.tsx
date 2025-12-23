"use client";

import { useEffect, useState } from "react";
import styles from "@/styles/profile.module.css";
import MembershipModal from "@/components/profile/membership/MembershipModal";
import {
  ArtistIcon,
  CreatorIcon,
  BusinessIcon,
  AiIcon,
} from "@/components/profile/membership/icons";
import { useCurrentWallet } from "@mysten/dapp-kit";

/* =========================
   TYPES
========================= */

type MembershipType = "artist" | "creator" | "business";

type CreatorPlan = "starter" | "pro" | "studio";

type Membership = {
  type: MembershipType;
  plan?: CreatorPlan;
  expireAt: number;
  txHash: string;
  block: number;
};

/* =========================
   COMPONENT
========================= */

export default function MembershipTab() {
  const { isConnected } = useCurrentWallet();

  const [membership, setMembership] = useState<Membership | null>(null);
  const [open, setOpen] = useState<MembershipType | null>(null);
  const [countdown, setCountdown] = useState("");

  /* ===== LOAD MEMBERSHIP ===== */
  useEffect(() => {
    const raw = localStorage.getItem("membership");
    if (raw) setMembership(JSON.parse(raw));
  }, []);

  /* ===== REALTIME COUNTDOWN ===== */
  useEffect(() => {
    if (!membership) return;

    const tick = () => {
      const diff = membership.expireAt - Date.now();

      if (diff <= 0) {
        setCountdown("Hết hạn");
        return;
      }

      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      setCountdown(`${d} ngày ${h}h ${m}m ${s}s`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [membership]);

  /* ===== CONFIRM (MUA / GIA HẠN / UPGRADE) ===== */
  const handleConfirm = (
    type: MembershipType,
    plan?: CreatorPlan,
    tx?: { txHash: string; block: number }
  ) => {
    const baseExpire =
      membership && membership.type === type
        ? membership.expireAt
        : Date.now();

    const data: Membership = {
      type,
      plan,
      expireAt: baseExpire + 365 * 24 * 60 * 60 * 1000,
      txHash: tx?.txHash || "0x_demo_tx_hash",
      block: tx?.block || Math.floor(Math.random() * 1_000_000),
    };

    setMembership(data);
    localStorage.setItem("membership", JSON.stringify(data));
    setOpen(null);
  };

  return (
    <>
      {/* =====================================================
          PHẦN TRÊN MEMBERSHIP (HEADER + WEB3 STATUS)
      ===================================================== */}
      <div className={styles.membershipHeader}>
        <div>
          <h1>
            Membership music <br />
            <span>Copyright Mode</span>
          </h1>

          <p style={{ marginTop: 12, fontSize: 14, opacity: 0.85 }}>
            Quản lý quyền tác giả, giao dịch và cấp phép nội dung số thông qua
            Blockchain SUI.
          </p>
        </div>

        <div className={styles.web3Status}>
          <h4>Trạng thái Web3</h4>
          <ul>
            <li>
              Ví SUI:&nbsp;
              <strong
                className={isConnected ? styles.ok : styles.warn}
              >
                {isConnected ? "Đã kết nối" : "Chưa kết nối"}
              </strong>
            </li>
            <li>
              Xác thực On-chain:&nbsp;
              <strong className={styles.ok}>Hoạt động</strong>
            </li>
            <li>
              Lưu trữ IPFS:&nbsp;
              <strong className={styles.ok}>Đảm bảo</strong>
            </li>
          </ul>
        </div>
      </div>

      {/* =====================================================
          CURRENT MEMBERSHIP INFO
      ===================================================== */}
      {membership && (
        <div className={styles.currentMembership}>
          <div>
            Bạn đang là{" "}
            <strong>
              {membership.type.toUpperCase()}
              {membership.plan &&
                ` (${membership.plan.toUpperCase()})`}
            </strong>
          </div>

          <small>
            Còn lại: {countdown} · Tx:{" "}
            <code>{membership.txHash}</code> · Block #
            {membership.block}
          </small>
        </div>
      )}

      {/* =====================================================
          MEMBERSHIP GRID
      ===================================================== */}
      <div className={styles.membershipGrid}>
        <Card
          title="Artist Membership"
          desc="Đăng ký & bảo vệ quyền tác giả cá nhân"
          icon={<ArtistIcon />}
          active={membership?.type === "artist"}
          onClick={() => setOpen("artist")}
        />

        <Card
          title="Creator Membership"
          desc="Sử dụng nội dung số theo gói"
          icon={<CreatorIcon />}
          active={membership?.type === "creator"}
          onClick={() => setOpen("creator")}
        />

        <Card
          title="Business Membership"
          desc="Cấp phép thương mại & bản quyền"
          icon={<BusinessIcon />}
          active={membership?.type === "business"}
          onClick={() => setOpen("business")}
        />

        <Card
          title="AI / Platform"
          desc="Dữ liệu huấn luyện AI hợp pháp"
          icon={<AiIcon />}
          locked
          onClick={() => {}}
        />
      </div>

      {/* =====================================================
          MODAL
      ===================================================== */}
      {open && (
        <MembershipModal
          type={open}
          onClose={() => setOpen(null)}
          onConfirm={(tx, plan) =>
            handleConfirm(open, plan, tx)
          }
        />
      )}
    </>
  );
}

/* =========================
   CARD
========================= */

function Card({
  title,
  desc,
  icon,
  onClick,
  active,
  locked,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  locked?: boolean;
}) {
  return (
    <div
      className={`${styles.membershipCardNew} ${
        active ? styles.ownedCard : ""
      } ${locked ? styles.lockedCard : ""}`}
    >
      <div className={styles.cardIcon}>{icon}</div>

      <h3>{title}</h3>
      <p className={styles.cardDesc}>{desc}</p>

      {active ? (
        <span className={styles.ownedBadge}>
          Gia hạn / Nâng cấp
        </span>
      ) : locked ? (
        <span className={styles.lockBadge}>Sắp mở</span>
      ) : (
        <button
          className={styles.confirmBtnWhite}
          onClick={onClick}
        >
          XÁC NHẬN
        </button>
      )}
    </div>
  );
}
