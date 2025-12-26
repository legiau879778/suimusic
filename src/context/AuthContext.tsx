"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  GoogleAuthProvider 
} from "firebase/auth";
import { auth, googleProvider, db } from "@/lib/firebase"; 
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useToast } from "@/context/ToastContext";
import { connectSuiWallet, signSuiMessage } from "@/lib/suiWallet";

// Sui & Bip39
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import * as bip39 from "bip39"; 

export type UserRole = "user" | "author" | "admin";

export type User = {
  id: string;
  email: string;
  avatar?: string;
  role: UserRole;
  walletAddress?: string;      
  wallet?: {
    address?: string;
    verified?: boolean;
  };
  internalWallet?: {        
    address: string;
    mnemonic: string;          
  };
  membership?: any;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  connectWallet: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  revokeWallet: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { showToast } = useToast();

  async function hydrateUser(firebaseUser: any) {
    if (!firebaseUser) {
      setUser(null);
      return;
    }
    const userRef = doc(db, "users", firebaseUser.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const data = userDoc.data();
      setUser({
        id: firebaseUser.uid,
        email: firebaseUser.email || "",
        avatar: firebaseUser.photoURL || "",
        role: data.role || "user",
        walletAddress: data.walletAddress,
        wallet: data.wallet,
        internalWallet: data.internalWallet,
        membership: data.membership,
      });
    } else {
      const mnemonic = bip39.generateMnemonic();
      const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
      const internalAddress = keypair.getPublicKey().toSuiAddress();

      const newUser: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email || "",
        avatar: firebaseUser.photoURL || "",
        role: "user",
        internalWallet: {
          address: internalAddress,
          mnemonic: mnemonic,
        },
      };

      await setDoc(userRef, {
        email: newUser.email,
        role: "user",
        internalWallet: newUser.internalWallet,
        createdAt: new Date(),
      });

      setUser(newUser);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      await hydrateUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, googleProvider);
      showToast("Đăng nhập thành công!", "success");
    } catch (error: any) {
      showToast("Đăng nhập thất bại", "warning");
    }
  };

  const connectWallet = async () => {
    if (!user) return;
    try {
      const address = await connectSuiWallet();
      if (!address) return;
      const ok = await signSuiMessage(`Verify wallet: ${user.email}`);
      if (!ok) return;

      const userRef = doc(db, "users", user.id);
      await setDoc(userRef, { 
        walletAddress: address,
        role: user.role === "admin" ? "admin" : "author" 
      }, { merge: true });

      setUser(prev => prev ? { ...prev, walletAddress: address, role: prev.role === "admin" ? "admin" : "author" } : null);
      showToast("Kết nối ví ngoài thành công!", "success");
    } catch (error) {
      showToast("Lỗi kết nối ví", "warning");
    }
  };

  const logout = async () => {
    await signOut(auth);
    showToast("Đã đăng xuất", "warning");
    router.push("/");
  };

  const revokeWallet = async () => {
    if (!user?.id) return;
    try {
      const userRef = doc(db, "users", user.id);
      await setDoc(
        userRef,
        { wallet: null, walletAddress: "", role: "user" },
        { merge: true }
      );
      setUser((prev) =>
        prev
          ? {
              ...prev,
              wallet: undefined,
              walletAddress: undefined,
              role: prev.role === "admin" ? "admin" : "user",
            }
          : prev
      );
      showToast("Đã gỡ ví", "success");
    } catch {
      showToast("Gỡ ví thất bại", "warning");
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      // auth.currentUser may be available in firebase auth
      // @ts-ignore
      const current = auth?.currentUser || null;
      await hydrateUser(current);
    } catch {
      // keep existing user if refresh fails
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(() => ({
    user, loading, loginWithGoogle, connectWallet, logout, refresh, revokeWallet
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
