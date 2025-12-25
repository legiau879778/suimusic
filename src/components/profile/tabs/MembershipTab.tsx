"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "@/styles/profile.module.css";

import MembershipModal from "@/components/profile/membership/MembershipModal";
import PurchaseToast from "@/components/common/PurchaseToast";

import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useCurrentAccount } from "@mysten/dapp-kit";

import {
  type Membership,
  type MembershipType,
  getCachedMembership,
  getActiveMembership,
  getMembershipEntitlements,
  getMembershipBadgeLabel,
  subscribeMembership,
} from "@/lib/membershipStore";

import { saveProfile } from "@/lib/profileStore";
import { ArtistIcon, CreatorIcon, BusinessIcon, AiIcon } from "@/components/profile/membership/icons";

function shortAddr(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 10)}…${addr.slice(-6)}`;
}

export default function MembershipTab() {
  const account = useCurrentAccount();
  const isConnected = !!account?.address;
  const walletAddress = account?.address ?? "";

  const { pushToast } = useToast();
  const { user, refresh } = useAuth();

  const memberKey = (user?.id || user?.email || "").trim(); // ✅ KEY CHUẨN
  const email = (user?.email || "").trim();

  const [membership, setMembership] = useState<Membership | null>(null);
  const [open, setOpen] = useState<MembershipType | null>(null);
  const [countdown, setCountdown] = useState("");

  const [toastOpen, setToastOpen] = useState(false);
  const [toastTx, setToastTx] = useState<string>("");

  const linkedWallet = (user?.wallet?.address || "").trim();

  const isWalletLinkedToUser = useMemo(() => {
    if (!walletAddress || !linkedWallet) return false;
    return walletAddress.toLowerCase() === linkedWallet.toLowerCase();
  }, [walletAddress, linkedWallet]);

  const ent = useMemo(() => getMembershipEntitlements(membership), [membership]);
  const statusOk = isConnected && !!linkedWallet && isWalletLinkedToUser;

  const unlockedText =
    ent.canManage || ent.canRegister || ent.canTrade
      ? `${ent.canManage ? "Manage " : ""}${ent.canRegister ? "Register " : ""}${ent.canTrade ? "Trade" : ""}`.trim()
      : "—";

  const copy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      pushToast("success", "Đã copy");
    } catch {
      pushToast("warning", "Không copy được");
    }
  };

  const loadMembership = async () => {
    if (!memberKey) {
      setMembership(null);
      setCountdown("");
      return;
    }

    const cached = getCachedMembership(memberKey, email);
    if (cached) setMembership(cached);

    try {
      const m = await getActiveMembership({ userId: memberKey, email });
      setMembership(m);
    } catch {
      // keep cached
    }
  };

  useEffect(() => {
    void loadMembership();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberKey, email]);

  useEffect(() => {
    if (!memberKey) return;

    const unsub = subscribeMembership(() => {
      void loadMembership();
    });

    const onStorage = () => void loadMembership();
    window.addEventListener("storage", onStorage);

    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberKey, email]);

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

  async function ensureWalletLinked() {
    if (!memberKey) {
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

    if (!linkedWallet) {
      try {
        await saveProfile(memberKey, { walletAddress });
        pushToast("success", "✅ Đã liên kết ví với hồ sơ");
        return true;
      } catch {
        pushToast("error", "Không thể liên kết ví (lỗi lưu profile)");
        return false;
      }
    }

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

  return (
    <>
      <div className={styles.membershipHeader}>
        <div>
          <h1>
            Membership music <br />
            <span>Copyright Mode</span>
          </h1>
          <p className={styles.membershipSub}>Chọn gói phù hợp để mở khóa quyền Manage / Register / Trade.</p>
        </div>

        <div className={styles.web3Box}>
          <div className={styles.web3Title}>Trạng thái Web3</div>

          <div className={styles.web3Row}>
            <div className={styles.web3Label}>Ví đang kết nối (extension)</div>
            <div className={styles.web3Right}>
              <span className={styles.addrPill} title={walletAddress || ""}>
                {walletAddress ? shortAddr(walletAddress) : "Chưa kết nối"}
              </span>
              <button className={styles.copyMini} onClick={() => copy(walletAddress)} disabled={!walletAddress} type="button">
                COPY
              </button>
            </div>
          </div>

          <div className={styles.web3Row}>
            <div className={styles.web3Label}>Ví đã liên kết (hồ sơ)</div>
            <div className={styles.web3Right}>
              <span className={styles.addrPill} title={linkedWallet || ""}>
                {linkedWallet ? shortAddr(linkedWallet) : "Chưa liên kết"}
              </span>
              <button className={styles.copyMini} onClick={() => copy(linkedWallet)} disabled={!linkedWallet} type="button">
                COPY
              </button>
            </div>
          </div>

          <div className={`${styles.web3StatusPill} ${statusOk ? styles.web3Ok : styles.web3Warn}`}>
            <span className={`${styles.web3Dot} ${statusOk ? styles.web3DotOk : styles.web3DotWarn} ${statusOk ? styles.web3PulseDot : ""}`} />
            <span className={statusOk ? styles.web3PulseText : ""}>{statusOk ? "Đã khớp" : "Chưa khớp"}</span>
          </div>

          <div className={styles.web3Meta}>
            <div>
              Quyền hiện tại:&nbsp;
              <strong className={membership ? styles.okText : styles.warnText}>
                {membership ? getMembershipBadgeLabel(membership) : "Chưa có"}
              </strong>
            </div>
            <div>
              Mở khóa menu:&nbsp;
              <strong className={unlockedText !== "—" ? styles.okText : styles.warnText}>{unlockedText}</strong>
            </div>
          </div>

          <div className={styles.web3Tip}>
            Tip: Quản lý ví tại tab <b>Thông tin cá nhân</b>. Bảng này chỉ hiển thị trạng thái.
          </div>
        </div>
      </div>

      {membership && (
        <div className={styles.currentMembership}>
          <div>
            Bạn đang là <strong>{getMembershipBadgeLabel(membership)}</strong>
          </div>
          <small>Còn lại: {countdown}</small>
        </div>
      )}

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

      {open && (
        <MembershipModal
          type={open}
          onClose={() => setOpen(null)}
          onSuccess={async (m) => {
            // update UI ngay
            setMembership(m);
            setOpen(null);

            // toast nổi + confetti + tx
            setToastTx(m?.txHash || "");
            setToastOpen(true);

            pushToast("success", "🎉 Membership đã được kích hoạt");

            // ✅ quan trọng: refresh auth (sync membership->role)
            await refresh();

            // ✅ load lại truth
            await loadMembership();
          }}
        />
      )}

      <PurchaseToast open={toastOpen} txHash={toastTx} onClose={() => setToastOpen(false)} />
    </>
  );
}

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
    <div className={`${styles.membershipCardNew} ${active ? styles.ownedCard : ""} ${locked ? styles.lockedCard : ""}`}>
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
        <button className={styles.confirmBtnWhite} onClick={onClick} type="button">
          Mua
        </button>
      )}
    </div>
  );
}
