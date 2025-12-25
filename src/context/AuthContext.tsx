"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";

import { loadUser, saveUser, clearUser } from "@/lib/authStorage";
import { consumeRedirect } from "@/lib/redirect";
import { ADMIN_EMAILS } from "@/lib/adminConfig";
import { useToast } from "@/context/ToastContext";

import { connectSuiWallet, signSuiMessage } from "@/lib/suiWallet";

import { clearMembership, subscribeMembership } from "@/lib/membershipStore";
import { clearProfile, loadProfile, subscribeProfile } from "@/lib/profileStore";

import { syncUserMembershipAndRole } from "@/lib/syncMembership";

export type UserRole = "user" | "author" | "admin";

export type WalletInfo = {
  address: string;
  verified: boolean;
};

export type MembershipType = "artist" | "creator" | "business" | "ai" | null;

export type User = {
  id: string;
  email: string;
  avatar?: string;
  role: UserRole;

  wallet?: WalletInfo;

  membership?: MembershipType;
  membershipNftId?: string;
};

type AuthContextType = {
  user: User | null;
  refresh: () => Promise<void>;
  loginWithGoogle: () => void;
  connectWallet: () => Promise<void>;
  revokeWallet: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

function isSameUser(a: User | null, b: User | null) {
  if (!a && !b) return true;
  if (!a || !b) return false;

  return (
    a.id === b.id &&
    a.email === b.email &&
    (a.avatar ?? "") === (b.avatar ?? "") &&
    a.role === b.role &&
    (a.membership ?? null) === (b.membership ?? null) &&
    (a.membershipNftId ?? "") === (b.membershipNftId ?? "") &&
    ((a.wallet?.address ?? "").toLowerCase() === (b.wallet?.address ?? "").toLowerCase()) &&
    (a.wallet?.verified ?? false) === (b.wallet?.verified ?? false)
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const { showToast } = useToast();

  const userId = user?.id ?? "";
  const userEmail = user?.email ?? "";

  // chống chạy chồng sync
  const syncingRef = useRef(false);

  async function syncAll(fromStorageFirst = true) {
    if (syncingRef.current) return;
    syncingRef.current = true;

    try {
      const base = fromStorageFirst ? loadUser() : user;

      if (!base?.id) {
        setUser(null);
        return;
      }

      let next: User = base;

      // 1) sync walletAddress từ profileStore -> auth (nếu thiếu)
      try {
        const p = loadProfile(next.id);
        const pAddr = (p.walletAddress || "").trim();

        if (pAddr) {
          const curr = (next.wallet?.address || "").trim();
          if (!curr || curr.toLowerCase() !== pAddr.toLowerCase()) {
            next = {
              ...next,
              wallet: {
                address: pAddr,
                verified: next.wallet?.verified ?? false,
              },
            };
          }
        }
      } catch {}

      // 2) sync membership -> role (truth verify + migrate key email->id)
      try {
        next = await syncUserMembershipAndRole(next);
      } catch {}

      // 3) apply
      setUser((prev) => {
        if (isSameUser(prev, next)) return prev;
        return next;
      });
      saveUser(next);
    } finally {
      syncingRef.current = false;
    }
  }

  /* ================= INIT LOAD ================= */

  useEffect(() => {
    const u = loadUser();
    setUser(u);
    // sync ngay khi mount để kéo wallet/membership đúng
    void syncAll(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ================= SUBSCRIBE: PROFILE (walletAddress) ================= */

  useEffect(() => {
    if (!userId) return;

    const unsub = subscribeProfile(userId, (p) => {
      const addr = (p.walletAddress || "").trim();
      if (!addr) return;

      setUser((prev) => {
        if (!prev || prev.id !== userId) return prev;

        const curr = (prev.wallet?.address || "").trim();
        if (curr.toLowerCase() === addr.toLowerCase()) return prev;

        const updated: User = {
          ...prev,
          wallet: {
            address: addr,
            verified: prev.wallet?.verified ?? false,
          },
        };

        saveUser(updated);
        return updated;
      });
    });

    return () => unsub();
  }, [userId]);

  /* ================= SUBSCRIBE: MEMBERSHIP (update header immediately) ================= */

  useEffect(() => {
    if (!userId) return;

    // subscribeMembership() của bạn là cb-only (same-tab event + storage)
    const unsub = subscribeMembership(() => {
      // mua xong / refresh tab khác / storage change -> sync lại role + membership ngay
      void syncAll(true);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userEmail]);

  /* ================= VISIBILITY: when back to tab ================= */

  useEffect(() => {
    if (!userId) return;

    const onVis = () => {
      if (document.visibilityState === "visible") {
        void syncAll(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* ================= PUBLIC refresh() ================= */

  async function refresh() {
    await syncAll(true);
  }

  /* ================= GOOGLE LOGIN ================= */

  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (token) => {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });

      const profile = await res.json();
      const isAdmin = ADMIN_EMAILS.includes(profile.email);

      let u: User = {
        id: profile.sub,
        email: profile.email,
        avatar: profile.picture,
        role: isAdmin ? "admin" : "user",
      };

      // pull wallet from profileStore if any
      try {
        const p = loadProfile(u.id);
        const pAddr = (p.walletAddress || "").trim();
        if (pAddr) u.wallet = { address: pAddr, verified: false };
      } catch {}

      // sync membership -> role
      try {
        u = await syncUserMembershipAndRole(u);
      } catch {}

      setUser(u);
      saveUser(u);

      showToast("Đăng nhập thành công", isAdmin ? "admin" : "success");
      router.replace(consumeRedirect());
    },
  });

  /* ================= WALLET ================= */

  async function connectWallet() {
    if (!user) return;

    const address = await connectSuiWallet();

    if (!address) {
      showToast(
        "Không kết nối được ví. Hãy mở Suiet Wallet và đảm bảo popup không bị chặn.",
        "warning"
      );
      return;
    }

    const ok = await signSuiMessage(`Chainstorm verify wallet\n${user.email}`);

    if (!ok) {
      showToast("Xác thực chữ ký thất bại", "warning");
      return;
    }

    // admin thì giữ admin, còn lại lên author
    let updated: User = {
      ...user,
      wallet: { address, verified: true },
      role: user.role === "admin" ? "admin" : "author",
    };

    try {
      const { saveProfile } = await import("@/lib/profileStore");
      saveProfile(updated.id, { walletAddress: address });
    } catch {}

    // membership có thể map lại role (vd business/creator/artist policy của bạn)
    try {
      updated = await syncUserMembershipAndRole(updated);
    } catch {}

    setUser(updated);
    saveUser(updated);

    showToast("Kết nối ví SUI thành công", "success");
  }

  function revokeWallet() {
    if (!user) return;

    const updated: User = {
      ...user,
      wallet: undefined,
      role: user.role === "admin" ? "admin" : "user",
    };

    setUser(updated);
    saveUser(updated);

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { saveProfile } = require("@/lib/profileStore");
      saveProfile(user.id, { walletAddress: "" });
    } catch {}

    showToast("Đã ngắt kết nối ví", "warning");
  }

  /* ================= LOGOUT ================= */
  function logout() {
    // 1) đóng session ngay lập tức
    setUser(null);
    clearUser(); // xóa authStorage (token/user)

    // 2) dọn các key “session-only”
    if (typeof window !== "undefined") {
      localStorage.removeItem("chainstorm_last_wallet");
      // nếu bạn có redirect lưu tạm
      localStorage.removeItem("chainstorm_redirect");
    }

    showToast("Đã đăng xuất", "warning");

    // 3) hard redirect để reset toàn bộ client state + subscriptions
    if (typeof window !== "undefined") {
      window.location.replace("/"); // replace tránh back quay lại profile
    } else {
      router.replace("/");
    }
  }

  const value = useMemo(
    () => ({
      user,
      refresh,
      loginWithGoogle,
      connectWallet,
      revokeWallet,
      logout,
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
