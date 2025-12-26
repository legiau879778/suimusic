"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "@/styles/profile.module.css";
import MembershipModal from "@/components/profile/membership/MembershipModal";
import PurchaseToast from "@/components/common/PurchaseToast";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useCurrentAccount, useConnectWallet, useWallets, useDisconnectWallet } from "@mysten/dapp-kit";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore"; // Thêm onSnapshot để realtime

import {
  type Membership,
  type MembershipType,
  getMembershipEntitlements,
  getMembershipBadgeLabel,
} from "@/lib/membershipStore";

import { ArtistIcon, CreatorIcon, BusinessIcon, AiIcon } from "@/components/profile/membership/icons";

function shortAddr(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 10)}…${addr.slice(-6)}`;
}

export default function MembershipTab() {
  const account = useCurrentAccount();
  const { mutate: connect } = useConnectWallet();
  const { mutate: disconnectExtension } = useDisconnectWallet();
  const wallets = useWallets();
  const { pushToast } = useToast();
  const { user, refresh } = useAuth();

  // State local để hứng dữ liệu realtime từ Firebase
  const [dbMembership, setDbMembership] = useState<Membership | null>(null);
  const [isManualConnected, setIsManualConnected] = useState(false);
  const [open, setOpen] = useState<MembershipType | null>(null);
  const [countdown, setCountdown] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [toastTx, setToastTx] = useState<string>("");

  const storageKey = useMemo(() => user?.id ? `wallet_active_${user.id}` : null, [user?.id]);

  // 1. Lắng nghe Firebase Realtime (Cực kỳ quan trọng)
  useEffect(() => {
    if (!user?.id) return;
    
    // Lắng nghe thay đổi trực tiếp từ Document của user
    const unsub = onSnapshot(doc(db, "users", user.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.membership) {
          setDbMembership(data.membership as Membership);
        }
      }
    });

    return () => unsub();
  }, [user?.id]);

  // 2. Ưu tiên lấy membership từ Firebase realtime, nếu chưa có thì lấy từ AuthContext
  const membership = useMemo(() => dbMembership || (user?.membership as Membership) || null, [dbMembership, user?.membership]);

  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      setIsManualConnected(saved === "true");
    }
  }, [storageKey]);

  const walletAddress = (isManualConnected && account?.address) ? account.address : "";
  const isConnected = !!walletAddress;
  const linkedWallet = (user?.walletAddress || user?.internalWallet?.address || "").trim();

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

  // Đếm ngược thời gian
  useEffect(() => {
    if (!membership?.expireAt) {
      setCountdown("");
      return;
    }
    const tick = () => {
      const diff = membership.expireAt - Date.now();
      if (diff <= 0) { setCountdown("Hết hạn"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(`${d} ngày ${h}h ${m}m`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [membership]);

  const handleConnect = () => {
    if (!storageKey || wallets.length === 0) return;
    connect({ wallet: wallets[0] }, {
      onSuccess: () => {
        localStorage.setItem(storageKey, "true");
        setIsManualConnected(true);
        pushToast("success", "Đã kết nối ví Extension");
      }
    });
  };

  const handleDisconnect = () => {
    if (storageKey) {
      localStorage.removeItem(storageKey);
      setIsManualConnected(false);
      disconnectExtension();
    }
  };

  const copy = async (text: string) => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); pushToast("success", "Đã copy"); } catch { pushToast("warning", "Không copy được"); }
  };

  async function openModal(type: MembershipType) {
    if (!isConnected) return pushToast("error", "Vui lòng nhấn 'KẾT NỐI VÍ'");
    setOpen(type);
  }

  return (
    <>
      <div className={styles.membershipHeader}>
        <div>
          <h1>Membership music <br /> <span>Copyright Mode</span></h1>
          <p className={styles.membershipSub}>Chọn gói phù hợp để mở khóa quyền Manage / Register / Trade.</p>
        </div>

        <div className={styles.web3Box}>
          <div className={styles.web3Title}>Trạng thái Web3</div>

          <div className={styles.web3Row}>
            <div className={styles.web3Label}>Ví đang kết nối (extension)</div>
            <div className={styles.web3Right}>
              {isConnected ? (
                <>
                  <span className={styles.addrPill}>{shortAddr(walletAddress)}</span>
                  <button className={styles.copyMini} onClick={() => copy(walletAddress)}>COPY</button>
                  <button className={styles.copyMini} style={{marginLeft: '4px', color: '#ff4d4d'}} onClick={handleDisconnect}>THOÁT</button>
                </>
              ) : (
                <button className={styles.copyMini} style={{background: '#0070f3', color: '#fff'}} onClick={handleConnect}>KẾT NỐI VÍ</button>
              )}
            </div>
          </div>

          <div className={styles.web3Row}>
            <div className={styles.web3Label}>Ví đã liên kết (hồ sơ)</div>
            <div className={styles.web3Right}>
              <span className={styles.addrPill}>{linkedWallet ? shortAddr(linkedWallet) : "Chưa liên kết"}</span>
              <button className={styles.copyMini} onClick={() => copy(linkedWallet)} disabled={!linkedWallet}>COPY</button>
            </div>
          </div>

          <div className={`${styles.web3StatusPill} ${statusOk ? styles.web3Ok : styles.web3Warn}`}>
            <span className={`${styles.web3Dot} ${statusOk ? styles.web3DotOk : styles.web3DotWarn} ${statusOk ? styles.web3PulseDot : ""}`} />
            <span className={statusOk ? styles.web3PulseText : ""}>{statusOk ? "Đã khớp" : "Chưa khớp"}</span>
          </div>

          <div className={styles.web3Meta}>
            <div>Quyền hiện tại:&nbsp; <strong className={membership ? styles.okText : styles.warnText}>{membership ? getMembershipBadgeLabel(membership) : "Chưa có"}</strong></div>
            <div>Mở khóa menu:&nbsp; <strong className={unlockedText !== "—" ? styles.okText : styles.warnText}>{unlockedText}</strong></div>
          </div>

          <div className={styles.web3Tip}>Tip: Quản lý ví tại tab <b>Thông tin cá nhân</b>. Bảng này chỉ hiển thị trạng thái.</div>
        </div>
      </div>

      {membership && (
        <div className={styles.currentMembership}>
          <div>Bạn đang là <strong>{getMembershipBadgeLabel(membership)}</strong></div>
          <small>Còn lại: {countdown}</small>
        </div>
      )}

      <div className={styles.membershipGrid}>
        <Card title="Artist" desc="Mở Manage + Register" icon={<ArtistIcon />} price="Từ 2.5 SUI / tháng" duration="~ 30 ngày" bullets={["1 tháng: 2.5 SUI", "3 tháng: 7.5 SUI", "1 năm: 30 SUI"]} active={membership?.type === "artist"} onClick={() => openModal("artist")} />
        <Card title="Creator" desc="Thuê / sử dụng bản quyền" icon={<CreatorIcon />} price="Từ 5 SUI / tháng" duration="~ 30 ngày" bullets={["Starter / Pro / Studio", "Chỉ dùng Trade"]} active={membership?.type === "creator"} onClick={() => openModal("creator")} />
        <Card title="Business" desc="Bản quyền thương mại" icon={<BusinessIcon />} price="60 SUI / năm" duration="~ 365 ngày" bullets={["Kinh doanh hợp pháp", "Trade thương mại"]} active={membership?.type === "business"} onClick={() => openModal("business")} />
        <Card title="AI / Platform" desc="Huấn luyện AI hợp pháp" icon={<AiIcon />} price="Sắp mở" duration="—" bullets={["Gói riêng cho nền tảng"]} locked onClick={() => {}} />
      </div>

      {open && (
        <MembershipModal
          type={open}
          onClose={() => setOpen(null)}
          onSuccess={async (m: any) => {
            setOpen(null);
            setToastTx(m?.txHash || "");
            setToastOpen(true);
            if (refresh) await refresh();
          }}
        />
      )}

      <PurchaseToast open={toastOpen} txHash={toastTx} onClose={() => setToastOpen(false)} />
    </>
  );
}

function Card({ title, desc, icon, price, duration, bullets, onClick, active, locked }: any) {
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
        {bullets.map((b: string) => <li key={b}>{b}</li>)}
      </ul>
      {active ? (
        <span className={styles.ownedBadge}>Đang dùng</span>
      ) : locked ? (
        <span className={styles.lockBadge}>Sắp mở</span>
      ) : (
        <button className={styles.confirmBtnWhite} onClick={onClick} type="button">Mua</button>
      )}
    </div>
  );
}