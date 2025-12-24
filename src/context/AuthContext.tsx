"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";

import { loadUser, saveUser, clearUser } from "@/lib/authStorage";
import { consumeRedirect } from "@/lib/redirect";
import { ADMIN_EMAILS } from "@/lib/adminConfig";
import { useToast } from "@/context/ToastContext";

import { connectSuiWallet, signSuiMessage } from "@/lib/suiWallet";

// ✅ clear local stores
import { clearMembership } from "@/lib/membershipStore";
import {
  clearProfile,
  loadProfile,
  subscribeProfile,
} from "@/lib/profileStore";

// ✅ membership truth -> role sync
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const { showToast } = useToast();

  /**
   * ✅ Boot:
   * - load auth user
   * - sync walletAddress from profileStore -> auth user (if missing)
   * - sync membership truth -> role
   */
  useEffect(() => {
    const u = loadUser();
    setUser(u);

    (async () => {
      if (!u?.id) return;

      // 1) sync walletAddress from profileStore -> auth (if missing)
      try {
        const p = loadProfile(u.id);
        const pAddr = (p.walletAddress || "").trim();

        if (pAddr && !u.wallet?.address) {
          const updatedWallet: User = {
            ...u,
            wallet: { address: pAddr, verified: false },
          };
          setUser(updatedWallet);
          saveUser(updatedWallet);
        }
      } catch {}

      // 2) sync membership -> role
      try {
        const latest = loadUser();
        if (!latest) return;
        const synced = await syncUserMembershipAndRole(latest);
        if (JSON.stringify(synced) !== JSON.stringify(latest)) {
          setUser(synced);
          saveUser(synced);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * ✅ Subscribe profile changes:
   * - When profileStore walletAddress changes (auto-link),
   *   sync into auth user.wallet.address and saveUser for UI updates.
   */
  useEffect(() => {
    const uid = user?.id || "";
    if (!uid) return;

    const unsub = subscribeProfile(uid, (p) => {
      const addr = (p.walletAddress || "").trim();
      if (!addr) return;

      setUser((prev) => {
        if (!prev || prev.id !== uid) return prev;

        const curr = prev.wallet?.address || "";
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
  }, [user?.id]);

  /**
   * ✅ Auto downgrade / auto sync membership -> role by polling
   * - catches expiry while user stays on the page
   * - also syncs immediately when tab becomes visible again
   */
  useEffect(() => {
    const uid = user?.id || "";
    if (!uid) return;

    let running = false;

    const tick = async () => {
      if (running) return;
      running = true;

      try {
        const latest = loadUser();
        if (!latest || latest.id !== uid) return;

        const synced = await syncUserMembershipAndRole(latest);

        if (JSON.stringify(synced) !== JSON.stringify(latest)) {
          setUser(synced);
          saveUser(synced);
        }
      } catch {
        // ignore
      } finally {
        running = false;
      }
    };

    // run once
    tick();

    // every minute
    const id = setInterval(tick, 60_000);

    // sync when user returns to the tab
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user?.id]);

  /**
 * ✅ Public refresh: re-read auth + sync wallet from profileStore + sync membership->role
 */
  async function refresh() {
    const u = loadUser();
    if (!u) {
      setUser(null);
      return;
    }

    // ✅ 1) sync walletAddress from profileStore -> auth user (if missing)
    try {
      const p = loadProfile(u.id);
      const pAddr = (p.walletAddress || "").trim();

      if (pAddr) {
        // nếu chưa có wallet hoặc wallet khác, đồng bộ lại
        const curr = (u.wallet?.address || "").trim();
        if (!curr || curr.toLowerCase() !== pAddr.toLowerCase()) {
          u.wallet = {
            address: pAddr,
            verified: u.wallet?.verified ?? false,
          };
        }
      }
    } catch {
      // ignore
    }

    // ✅ 2) sync membership truth -> role
    try {
      const synced = await syncUserMembershipAndRole(u);

      setUser(synced);
      saveUser(synced);
    } catch {
      setUser(u);
      saveUser(u);
    }
  }

  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (token) => {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
        },
      });

      const profile = await res.json();
      const isAdmin = ADMIN_EMAILS.includes(profile.email);

      let u: User = {
        id: profile.sub,
        email: profile.email,
        avatar: profile.picture,
        role: isAdmin ? "admin" : "user",
      };

      // ✅ if profileStore already has walletAddress -> sync into auth user
      try {
        const p = loadProfile(u.id);
        const pAddr = (p.walletAddress || "").trim();
        if (pAddr) {
          u.wallet = { address: pAddr, verified: false };
        }
      } catch {}

      // ✅ sync membership truth -> role
      try {
        u = await syncUserMembershipAndRole(u);
      } catch {}

      setUser(u);
      saveUser(u);

      showToast("Đăng nhập thành công", isAdmin ? "admin" : "success");
      router.replace(consumeRedirect());
    },
  });

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

    // base update
    let updated: User = {
      ...user,
      wallet: {
        address,
        verified: true,
      },
      // keep admin, otherwise author when wallet verified
      role: user.role === "admin" ? "admin" : "author",
    };

    // ✅ also save to profileStore (field = walletAddress)
    try {
      const { saveProfile } = await import("@/lib/profileStore");
      saveProfile(updated.id, { walletAddress: address });
    } catch {}

    // ✅ sync membership truth -> role (don’t force author if membership says otherwise)
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

    // ✅ optional: clear walletAddress in profileStore so it won’t auto-link
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { saveProfile } = require("@/lib/profileStore");
      saveProfile(user.id, { walletAddress: "" });
    } catch {}

    showToast("Đã ngắt kết nối ví", "warning");
  }

  function logout() {
    const uid = user?.id || "";

    if (uid) {
      clearMembership(uid);
      clearProfile(uid);
    }

    if (typeof window !== "undefined") {
      localStorage.removeItem("chainstorm_last_wallet");
    }

    setUser(null);
    clearUser();

    showToast("Đã đăng xuất", "warning");

    if (typeof window !== "undefined") {
      window.location.href = "/";
    } else {
      router.replace("/");
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        refresh,
        loginWithGoogle,
        connectWallet,
        revokeWallet,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
