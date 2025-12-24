"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "@/styles/profile.module.css";
import MembershipModal from "@/components/profile/membership/MembershipModal";
import { useAuth } from "@/context/AuthContext";


// ✅ dùng account cho ổn định
import { useCurrentAccount } from "@mysten/dapp-kit";

import {
  type Membership,
  type MembershipType,
  getActiveMembership,
  getMembershipEntitlements,
  getMembershipBadgeLabel,
} from "@/lib/membershipStore";

import { useToast } from "@/context/ToastContext";

// ✅ thêm saveProfile (nếu file bạn đang có tên khác, đổi lại đúng tên hàm)
import { saveProfile } from "@/lib/profileStore";

// icons
import {
  ArtistIcon,
  CreatorIcon,
  BusinessIcon,
  AiIcon,
} from "@/components/profile/membership/icons";

export default function MembershipTab() {
  /* ---------- WEB3 ---------- */
  const account = useCurrentAccount();
  const isConnected = !!account?.address;
  const walletAddress = account?.address ?? "";

  /* ---------- APP ---------- */
  const { pushToast } = useToast();
  const { user, refresh } = useAuth();
  const userId = user?.id ?? "";

  /* ---------- STATE ---------- */
  const [membership, setMembership] = useState<Membership | null>(null);
  const [open, setOpen] = useState<MembershipType | null>(null);
  const [countdown, setCountdown] = useState("");

  /* ===================== DERIVED ======================== */

  /** ví extension === ví đã verify của user */
  const isWalletLinkedToUser = useMemo(() => {
    if (!walletAddress || !user?.wallet?.address) return false;
    return walletAddress.toLowerCase() === user.wallet.address.toLowerCase();
  }, [walletAddress, user?.wallet?.address]);

  const ent = useMemo(
    () => getMembershipEntitlements(membership),
    [membership]
  );

  /* ===================== EFFECT ========================= */

  /** load membership theo user */
  useEffect(() => {
    setMembership(null);
    setCountdown("");
    setOpen(null);

    if (!userId) return;
    getActiveMembership(userId).then(setMembership);
  }, [userId]);

  /** countdown – update mỗi phút */
  useEffect(() => {
    if (!membership?.expireAt) return;

    const tick = () => {
      const diff = membership.expireAt - Date.now();
      if (diff <= 0) {
        setMembership(null);
        setCountdown("");
        return;
      }

      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);

      setCountdown(`${d} ngày ${h}h ${m}m`);
    };

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [membership]);

  /* ===================== ACTION ========================= */

  async function ensureWalletLinked() {
    if (!userId) {
      pushToast("error", "Bạn cần đăng nhập trước");
      return false;
    }
    if (!isConnected) {
      pushToast("error", "Vui lòng kết nối ví SUI");
      return false;
    }
    if (!walletAddress) {
      pushToast("error", "Không lấy được địa chỉ ví");
      return false;
    }

    // ✅ Nếu user CHƯA link ví trong profile -> auto link
    if (!user?.wallet?.address) {
      try {
        await saveProfile(userId, { walletAddress });

        pushToast("success", "✅ Đã liên kết ví với tài khoản");
        return true;
      } catch (e) {
        pushToast("error", "Không thể liên kết ví (lỗi lưu profile)");
        return false;
      }
    }

    // ✅ Nếu đã có ví trong user nhưng khác ví đang connect -> chặn
    if (!isWalletLinkedToUser) {
      pushToast("warning", "Ví đang kết nối không khớp ví đã liên kết");
      return false;
    }

    return true;
  }

  async function openModal(type: MembershipType) {
    const ok = await ensureWalletLinked();
    if (!ok) return;
    setOpen(type);
  }

  /* ===================== RENDER ========================= */

  return (
    <>
      {/* ===== HEADER ===== */}
      <div className={styles.membershipHeader}>
        <div>
          <h1>
            Membership music <br />
            <span>Copyright Mode</span>
          </h1>

          <p style={{ marginTop: 12, fontSize: 14, opacity: 0.85 }}>
            Chọn gói phù hợp để mở khóa quyền Manage / Register / Trade.
          </p>
        </div>

        <div className={styles.web3Status}>
          <h4>Trạng thái Web3</h4>
          <ul>
            <li>
              Ví SUI:&nbsp;
              <strong className={isConnected ? styles.ok : styles.warn}>
                {isConnected ? "Đã kết nối" : "Chưa kết nối"}
              </strong>
            </li>

            <li>
              Ví liên kết user:&nbsp;
              <strong className={isWalletLinkedToUser ? styles.ok : styles.warn}>
                {isWalletLinkedToUser ? "Đã liên kết" : "Chưa liên kết"}
              </strong>
            </li>

            <li>
              Quyền hiện tại:&nbsp;
              <strong className={membership ? styles.ok : styles.warn}>
                {membership ? getMembershipBadgeLabel(membership) : "Chưa có"}
              </strong>
            </li>

            <li>
              Mở khóa menu:&nbsp;
              <strong className={styles.ok}>
                {ent.canManage || ent.canRegister || ent.canTrade ? (
                  <>
                    {ent.canManage && "Manage "}
                    {ent.canRegister && "Register "}
                    {ent.canTrade && "Trade"}
                  </>
                ) : (
                  "—"
                )}
              </strong>
            </li>
          </ul>
        </div>
      </div>

      {/* ===== CURRENT MEMBERSHIP ===== */}
      {membership && (
        <div className={styles.currentMembership}>
          <div>
            Bạn đang là <strong>{getMembershipBadgeLabel(membership)}</strong>
          </div>
          <small>Còn lại: {countdown}</small>
        </div>
      )}

      {/* ===== PRICING ===== */}
      <div className={styles.membershipGrid}>
        <Card
          title="Artist"
          desc="Mở Manage + Register"
          icon={<ArtistIcon />}
          price="30 SUI / năm"
          duration="~ 365 ngày"
          bullets={["Quản lý & đăng ký tác phẩm", "Gia hạn linh hoạt"]}
          active={membership?.type === "artist"}
          onClick={() => openModal("artist")}
        />

        <Card
          title="Creator"
          desc="Thuê / sử dụng bản quyền"
          icon={<CreatorIcon />}
          price="Từ 5 SUI / tháng"
          duration="~ 30 ngày"
          bullets={["Starter / Pro / Studio", "Chỉ dùng Trade"]}
          active={membership?.type === "creator"}
          onClick={() => openModal("creator")}
        />

        <Card
          title="Business"
          desc="Bản quyền thương mại"
          icon={<BusinessIcon />}
          price="60 SUI / năm"
          duration="~ 365 ngày"
          bullets={["Kinh doanh hợp pháp", "Trade thương mại"]}
          active={membership?.type === "business"}
          onClick={() => openModal("business")}
        />

        <Card
          title="AI / Platform"
          desc="Huấn luyện AI hợp pháp"
          icon={<AiIcon />}
          price="Sắp mở"
          duration="—"
          bullets={["Gói riêng cho nền tảng"]}
          locked
          onClick={() => {}}
        />
      </div>

      {/* ===== MODAL ===== */}
      {open && (
        <MembershipModal
          type={open}
          onClose={() => setOpen(null)}
          onSuccess={async (m) => {
            setMembership(m);
            setOpen(null);
            pushToast("success", "🎉 Membership đã được kích hoạt");
            await refresh();
          }}
        />
      )}
    </>
  );
}

/* ======================== CARD ======================== */

function Card({
  title,
  desc,
  icon,
  price,
  duration,
  bullets,
  onClick,
  active,
  locked,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  price: string;
  duration: string;
  bullets: string[];
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

      <div className={styles.priceBox}>
        <div className={styles.priceMain}>{price}</div>
        <div className={styles.priceSub}>{duration}</div>
      </div>

      <ul className={styles.perkList}>
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>

      {active ? (
        <span className={styles.ownedBadge}>Đang dùng</span>
      ) : locked ? (
        <span className={styles.lockBadge}>Sắp mở</span>
      ) : (
        <button className={styles.confirmBtnWhite} onClick={onClick}>
          Mua
        </button>
      )}
    </div>
  );
}
