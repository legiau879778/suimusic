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

  const memberKey = (user?.id || user?.email || "").trim();
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
      pushToast("success", "Copied");
    } catch {
      pushToast("warning", "Copy failed");
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
      setCountdown(`${d} days ${h}h ${m}m`);
    };

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [membership]);

  async function ensureWalletLinked() {
    if (!memberKey) {
      pushToast("error", "You need to sign in first");
      return false;
    }
    if (!isConnected) {
      pushToast("error", "Please connect a SUI wallet");
      return false;
    }
    if (!walletAddress) {
      pushToast("error", "Unable to get wallet address");
      return false;
    }

    if (!linkedWallet) {
      try {
        await saveProfile(memberKey, { walletAddress });
        pushToast("success", "Wallet linked to profile");
        return true;
      } catch {
        pushToast("error", "Unable to link wallet (profile save failed)");
        return false;
      }
    }

    if (!isWalletLinkedToUser) {
      pushToast("warning", "Connected wallet does not match linked wallet");
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
          <p className={styles.membershipSub}>Choose a plan to unlock Manage / Register / Trade.</p>
        </div>

        <div className={styles.web3Box}>
          <div className={styles.web3Title}>Web3 status</div>

          <div className={styles.web3Row}>
            <div className={styles.web3Label}>Connected wallet (extension)</div>
            <div className={styles.web3Right}>
              <span className={styles.addrPill} title={walletAddress || ""}>
                {walletAddress ? shortAddr(walletAddress) : "Not connected"}
              </span>
              <button className={styles.copyMini} onClick={() => copy(walletAddress)} disabled={!walletAddress} type="button">
                COPY
              </button>
            </div>
          </div>

          <div className={styles.web3Row}>
            <div className={styles.web3Label}>Linked wallet (profile)</div>
            <div className={styles.web3Right}>
              <span className={styles.addrPill} title={linkedWallet || ""}>
                {linkedWallet ? shortAddr(linkedWallet) : "Not linked"}
              </span>
              <button className={styles.copyMini} onClick={() => copy(linkedWallet)} disabled={!linkedWallet} type="button">
                COPY
              </button>
            </div>
          </div>

          <div className={`${styles.web3StatusPill} ${statusOk ? styles.web3Ok : styles.web3Warn}`}>
            <span className={`${styles.web3Dot} ${statusOk ? styles.web3DotOk : styles.web3DotWarn} ${statusOk ? styles.web3PulseDot : ""}`} />
            <span className={statusOk ? styles.web3PulseText : ""}>{statusOk ? "Matched" : "Not matched"}</span>
          </div>

          <div className={styles.web3Meta}>
            <div>
              Current access:&nbsp;
              <strong className={membership ? styles.okText : styles.warnText}>
                {membership ? getMembershipBadgeLabel(membership) : "None"}
              </strong>
            </div>
            <div>
              Menu unlocked:&nbsp;
              <strong className={unlockedText !== "—" ? styles.okText : styles.warnText}>{unlockedText}</strong>
            </div>
          </div>

          <div className={styles.web3Tip}>
            Tip: Manage your wallet in <b>Personal info</b>. This panel only shows status.
          </div>
        </div>
      </div>

      {membership && (
        <div className={styles.currentMembership}>
          <div>
            You are <strong>{getMembershipBadgeLabel(membership)}</strong>
          </div>
          <small>Remaining: {countdown}</small>
        </div>
      )}

      <div className={styles.membershipGrid}>
        <Card
          title="Artist"
          desc="Unlock Manage + Register"
          icon={<ArtistIcon />}
          price="From 2.5 SUI / month"
          duration="~ 30 days"
          bullets={["1 month: 2.5 SUI", "3 months: 7.5 SUI", "1 year: 30 SUI"]}
          active={membership?.type === "artist"}
          onClick={() => openModal("artist")}
        />

        <Card
          title="Creator"
          desc="License / use rights"
          icon={<CreatorIcon />}
          price="From 5 SUI / month"
          duration="~ 30 days"
          bullets={["Starter / Pro / Studio", "Trade only"]}
          active={membership?.type === "creator"}
          onClick={() => openModal("creator")}
        />

        <Card
          title="Business"
          desc="Commercial rights"
          icon={<BusinessIcon />}
          price="60 SUI / year"
          duration="~ 365 days"
          bullets={["Legal business use", "Commercial trading"]}
          active={membership?.type === "business"}
          onClick={() => openModal("business")}
        />

        <Card
          title="AI / Platform"
          desc="Legal AI training"
          icon={<AiIcon />}
          price="Coming soon"
          duration="—"
          bullets={["Platform-specific plans"]}
          locked
          onClick={() => {}}
        />
      </div>

      {open && (
        <MembershipModal
          type={open}
          onClose={() => setOpen(null)}
          onSuccess={async (m) => {
            setMembership(m);
            setOpen(null);

            setToastTx(m?.txHash || "");
            setToastOpen(true);

            pushToast("success", "Membership activated");

            await refresh();
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
        <span className={styles.ownedBadge}>In use</span>
      ) : locked ? (
        <span className={styles.lockBadge}>Coming soon</span>
      ) : (
        <button className={styles.confirmBtnWhite} onClick={onClick} type="button">
          Buy
        </button>
      )}
    </div>
  );
}
