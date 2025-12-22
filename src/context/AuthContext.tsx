"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";

import { loadUser, saveUser, clearUser } from "@/lib/authStorage";
import { connectSuiWallet, signSuiMessage } from "@/lib/suiWallet";
import { consumeRedirect } from "@/lib/redirect";
import { ADMIN_EMAILS } from "@/lib/adminConfig";
import { addAdminWallet } from "@/lib/adminWalletStore";
import { useToast } from "@/context/ToastContext";

/* ================= TYPES ================= */

export type UserRole = "user" | "author" | "admin";

export type WalletInfo = {
  address: string;
  verified: boolean;
};

export type User = {
  id: string;
  email: string;
  avatar?: string;
  role: UserRole;
  wallet?: WalletInfo;
};

/* ================= CONTEXT ================= */

type AuthContextType = {
  user: User | null;
  loginWithGoogle: () => void;
  connectWallet: () => Promise<void>;
  revokeWallet: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>(
  {} as AuthContextType
);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const { showToast } = useToast();

  /* ===== RESTORE USER ===== */
  useEffect(() => {
    setUser(loadUser());
  }, []);

  /* ===== GOOGLE LOGIN ===== */
  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (token) => {
      const res = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
          },
        }
      );

      const profile = await res.json();
      const isAdmin = ADMIN_EMAILS.includes(profile.email);

      const u: User = {
        id: profile.sub,
        email: profile.email,
        avatar: profile.picture,
        role: isAdmin ? "admin" : "user",
      };

      setUser(u);
      saveUser(u);

      showToast(
        "Đăng nhập thành công",
        isAdmin ? "admin" : "success"
      );

      router.replace(consumeRedirect());
    },
  });

  /* ===== CONNECT SUI WALLET ===== */
  async function connectWallet() {
    if (!user) return;

    const address = await connectSuiWallet();
    const message = `Chainstorm verify wallet\n${user.email}`;
    await signSuiMessage(message);

    const upgraded = user.role === "user";

    const updated: User = {
      ...user,
      wallet: {
        address,
        verified: true,
      },
      role: user.role === "admin" ? "admin" : "author",
    };

    setUser(updated);
    saveUser(updated);

    if (updated.role === "admin") {
      addAdminWallet(updated.email, address, 1);
    }

    showToast(
      upgraded
        ? "Nâng quyền tác giả thành công"
        : "Kết nối ví thành công",
      updated.role === "admin" ? "admin" : "author"
    );

    router.replace(consumeRedirect());
  }

  /* ===== REVOKE WALLET ===== */
  function revokeWallet() {
    if (!user) return;

    const updated: User = {
      ...user,
      wallet: undefined,
      role: user.role === "admin" ? "admin" : "user",
    };

    setUser(updated);
    saveUser(updated);

    showToast("Đã ngắt kết nối ví", "info");
  }

  /* ===== LOGOUT ===== */
  function logout() {
    setUser(null);
    clearUser();
    showToast("Đã đăng xuất", "info");
    router.replace("/");
  }

  return (
    <AuthContext.Provider
      value={{
        user,
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
