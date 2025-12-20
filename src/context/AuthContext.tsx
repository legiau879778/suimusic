"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { User } from "@/lib/authStore";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (u: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /* 🔥 CHỈ CHẠY 1 LẦN KHI CLIENT MOUNT */
  useEffect(() => {
    const raw = localStorage.getItem("auth_user");
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  const login = (u: User) => {
    localStorage.setItem("auth_user", JSON.stringify(u));
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem("auth_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
