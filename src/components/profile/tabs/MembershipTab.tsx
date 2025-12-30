"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "@/styles/profile.module.css";
import MembershipModal from "@/components/profile/membership/MembershipModal";
import PurchaseToast from "@/components/common/PurchaseToast";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useCurrentAccount, useConnectWallet, useWallets, useDisconnectWallet } from "@mysten/dapp-kit";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

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

  const [dbMembership, setDbMembership] = useState<Membership | null>(null);
  const [isManualConnected, setIsManualConnected] = useState(false);
  const [open, setOpen] = useState<MembershipType | null>(null);
  const [countdown, setCountdown] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [toastTx, setToastTx] = useState<string>("");

  const storageKey = useMemo(() => user?.id ? `wallet_active_${user.id}` : null, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const unsub = onSnapshot(doc(db, "users", user.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.membership) setDbMembership(data.membership as Membership);
      }
    });
    return () => unsub();
  }, [user?.id]);

  const membership = useMemo(() => dbMembership || (user?.membership as Membership) || null, [dbMembership, user?.membership]);

  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      setIsManualConnected(saved === "true");
    }
  }, [storageKey]);

  const walletAddress = (isManualConnected && account?.address) ? account.address : "";
  const isConnected = !!walletAddress;
  const linkedWallet = (user?.internalWallet?.address || "").trim();

  const ent = useMemo(() => getMembershipEntitlements(membership), [membership]);
  const statusOk = isConnected && linkedWallet && walletAddress.toLowerCase() === linkedWallet.toLowerCase();

  const unlockedText = ent.canManage || ent.canRegister || ent.canTrade
    ? `${ent.canManage ? "Manage " : ""}${ent.canRegister ? "Register " : ""}${ent.canTrade ? "Trade" : ""}`.trim()
    : "—";

  async function openModal(type: MembershipType) {
    const hasInternalWallet = !!user?.internalWallet?.address;
    // NẾU CÓ VÍ NỘI BỘ THÌ CHO MỞ MODAL LUÔN, KHÔNG CẦN CONNECT VÍ NGOÀI
    if (!hasInternalWallet && !isConnected) {
      return pushToast("error", "Please connect Slush wallet or top up your Heritage wallet.");
    }
    setOpen(type);
  }

  return (
    <>
      <div className={styles.membershipHeader}>
        <div>
          <h1>Membership Music <br /> <span>Copyright Mode</span></h1>
          <p className={styles.membershipSub}>Choose a plan to unlock Manage / Register / Trade.</p>
        </div>

        <div className={styles.web3Box}>
          <div className={styles.web3Title}>Web3 Status</div>
          <div className={styles.web3Row}>
            <div className={styles.web3Label}>Heritage Wallet (Internal)</div>
            <div className={styles.web3Right}>
              <span className={styles.addrPill}>{linkedWallet ? shortAddr(linkedWallet) : "Not created"}</span>
            </div>
          </div>
          <div className={styles.web3Row}>
            <div className={styles.web3Label}>Extension Wallet (Slush)</div>
            <div className={styles.web3Right}>
              {isConnected ? (
                <span className={styles.addrPill} style={{color: '#4ade80'}}>{shortAddr(walletAddress)}</span>
              ) : (
                <button className={styles.copyMini} onClick={() => connect({ wallet: wallets[0] })}>CONNECT</button>
              )}
            </div>
          </div>
          <div className={styles.web3Meta}>
            <div>Current plan: <strong className={styles.okText}>{membership ? getMembershipBadgeLabel(membership) : "None"}</strong></div>
          </div>
        </div>
      </div>

      <div className={styles.membershipGrid}>
        <Card
          title="Artist"
          desc="Manage + Register access"
          price="From 0.01 SUI"
          active={membership?.type === "artist"}
          onClick={() => openModal("artist")}
          bullets={[
            "Access Manage + Register",
            "Upload fee: 5 SUI / track",
            "Subscription split: Artist 90% • Platform 10%",
          ]}
        />
        <Card
          title="Creator"
          desc="Marketplace access"
          price="From 0.01 SUI"
          active={membership?.type === "creator"}
          onClick={() => openModal("creator")}
          bullets={[
            "Use licensed music with verification",
            "Revenue split: Artist 75% • Platform 25%",
            "License trading support",
          ]}
        />
        <Card
          title="Business"
          desc="Manage + Register + Marketplace"
          price="0.05 SUI"
          active={membership?.type === "business"}
          onClick={() => openModal("business")}
          bullets={[
            "Upload fee: 20 SUI / track",
            "Revenue split: Artist 75% • Platform 25%",
            "Commercial usage",
          ]}
        />
        <Card
          title="AI / Platform"
          desc="Data access + compliant training"
          price="0.1 SUI / 30 days"
          active={membership?.type === "ai"}
          actionLabel="Buy"
          onClick={() => openModal("ai")}
          bullets={[
            "Access licensed datasets",
            "Compliance with copyright policy",
            "Transparent reporting",
          ]}
        />
      </div>

      {open && (
        <MembershipModal
          type={open}
          onClose={() => setOpen(null)}
          onSuccess={(m: any) => {
            setOpen(null);
            setToastTx(m?.txHash || "");
            setToastOpen(true);
          }}
        />
      )}
      <PurchaseToast open={toastOpen} txHash={toastTx} onClose={() => setToastOpen(false)} />
    </>
  );
}

function Card({ title, desc, price, onClick, active, bullets, actionLabel, actionHref }: any) {
  return (
    <div className={`${styles.membershipCardNew} ${active ? styles.ownedCard : ""}`}>
      <h3>{title}</h3>
      <p>{desc}</p>
      <div className={styles.priceMain}>{price}</div>
      <ul className={styles.perkList}>{bullets.map((b: any) => <li key={b}>{b}</li>)}</ul>
      {active ? (
        <span className={styles.ownedBadge}>Active</span>
      ) : actionHref ? (
        <a className={styles.confirmBtnWhite} href={actionHref}>
          {actionLabel || "Contact"}
        </a>
      ) : (
        <button className={styles.confirmBtnWhite} onClick={onClick}>
          {actionLabel || "Buy now"}
        </button>
      )}
    </div>
  );
}
