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

// ✅ profileStore = source of truth cho ví đã liên kết
import { loadProfile, saveProfile } from "@/lib/profileStore";

// icons
import {
  ArtistIcon,
  CreatorIcon,
  BusinessIcon,
  AiIcon,
} from "@/components/profile/membership/icons";

/* ================= HELPERS ================= */

async function copyText(v: string) {
  try {
    await navigator.clipboard.writeText(v);
    return true;
  } catch {
    return false;
  }
}

export default function MembershipTab() {
  /* ---------- WEB3 ---------- */
  const account = useCurrentAccount();
  const isConnected = !!account?.address;
  const walletAddress = account?.address ?? "";

  /* ---------- APP ---------- */
  const { pushToast } = useToast();
  const { user, refresh, connectWallet, revokeWallet } = useAuth();
  const userId = user?.id ?? "";

  /* ---------- STATE ---------- */
  const [membership, setMembership] = useState<Membership | null>(null);
  const [open, setOpen] = useState<MembershipType | null>(null);
  const [countdown, setCountdown] = useState("");

  /* ===================== DERIVED ======================== */

  // ✅ ví đã liên kết (hồ sơ) = source of truth khi refresh
  const linkedWallet = useMemo(() => {
    if (!userId) return "";
    const p = loadProfile(userId);
    return (p.walletAddress || "").trim().toLowerCase();
  }, [userId]);

  // ✅ ví extension === ví đã liên kết (profileStore)
  const isWalletLinkedToUser = useMemo(() => {
    if (!walletAddress || !linkedWallet) return false;
    return walletAddress.toLowerCase() === linkedWallet;
  }, [walletAddress, linkedWallet]);

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

    // ✅ Nếu hồ sơ chưa có ví -> auto link
    if (!linkedWallet) {
      try {
        await saveProfile(userId, { walletAddress });
        pushToast("success", "✅ Đã liên kết ví với tài khoản");
        return true;
      } catch {
        pushToast("error", "Không thể liên kết ví (lỗi lưu profile)");
        return false;
      }
    }

    // ✅ Nếu đã link nhưng khác ví extension -> chặn
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

        {/* ===== WEB3 STATUS (FULL) ===== */}
        <div className={styles.web3Status}>
          <h4>Trạng thái Web3</h4>

          {/* Extension wallet */}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
              Ví đang kết nối (extension)
            </div>

            {!walletAddress ? (
              <div className={styles.walletConnectBox}>
                <p>Bạn chưa kết nối ví SUI</p>
                <button
                  className={styles.connectBtn}
                  onClick={async () => {
                    try {
                      await connectWallet();
                    } catch {
                      // connectWallet đã toast bên trong
                    }
                  }}
                >
                  Kết nối ví
                </button>
              </div>
            ) : (
              <div className={styles.walletRow}>
                <input value={walletAddress} readOnly />
                <button
                  className={styles.copyBtn}
                  onClick={async () => {
                    const ok = await copyText(walletAddress);
                    pushToast(ok ? "success" : "warning", ok ? "✓ Đã copy" : "Không copy được");
                  }}
                >
                  COPY
                </button>
              </div>
            )}
          </div>

          {/* Linked wallet */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
              Ví đã liên kết (hồ sơ)
            </div>

            {linkedWallet ? (
              <div className={styles.walletRow}>
                <input value={linkedWallet} readOnly />
                <button
                  className={styles.copyBtn}
                  onClick={async () => {
                    const ok = await copyText(linkedWallet);
                    pushToast(ok ? "success" : "warning", ok ? "✓ Đã copy" : "Không copy được");
                  }}
                >
                  COPY
                </button>
              </div>
            ) : (
              <div className={styles.autoSaveHint} style={{ opacity: 0.9 }}>
                Chưa liên kết ví với tài khoản.
              </div>
            )}
          </div>

          {/* Status row */}
          <div
            className={styles.balanceBox}
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 12,
            }}
          >
            <span>Trạng thái</span>

            {!walletAddress ? (
              <strong className={styles.warn}>Chưa kết nối ví</strong>
            ) : !linkedWallet ? (
              <strong className={styles.warn}>Chưa liên kết hồ sơ</strong>
            ) : isWalletLinkedToUser ? (
              <strong className={styles.ok}>✅ Đã khớp</strong>
            ) : (
              <strong className={styles.warn}>⚠️ Lệch ví</strong>
            )}
          </div>

          {/* Membership + entitlements */}
          <ul style={{ marginTop: 10 }}>
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

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <button
              className={styles.connectBtn}
              disabled={!walletAddress || (linkedWallet && isWalletLinkedToUser)}
              onClick={async () => {
                if (!walletAddress) return;
                await saveProfile(userId, { walletAddress });
                pushToast("success", "✅ Đã đồng bộ ví vào hồ sơ");
              }}
              title={
                !walletAddress
                  ? "Hãy kết nối ví trước"
                  : linkedWallet && isWalletLinkedToUser
                  ? "Ví đã khớp"
                  : "Lưu ví hiện tại vào hồ sơ"
              }
            >
              {linkedWallet && isWalletLinkedToUser ? "Đã đồng bộ" : "Đồng bộ ví vào hồ sơ"}
            </button>

            {walletAddress && linkedWallet && !isWalletLinkedToUser && (
              <button
                className={styles.connectBtn}
                onClick={async () => {
                  await saveProfile(userId, { walletAddress });
                  pushToast("success", "✅ Đã cập nhật ví hồ sơ theo ví hiện tại");
                }}
              >
                Dùng ví hiện tại
              </button>
            )}

            <button
              className={styles.disconnectBtn}
              onClick={() => revokeWallet()}
              disabled={!user?.wallet?.address && !linkedWallet}
              title="Gỡ ví khỏi tài khoản"
            >
              Ngắt kết nối
            </button>
          </div>

          <div className={styles.autoSaveHint} style={{ marginTop: 8 }}>
            Tip: Quyền mua membership dựa trên <b>ví đã liên kết (hồ sơ)</b> để tránh lệch khi refresh.
          </div>
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
