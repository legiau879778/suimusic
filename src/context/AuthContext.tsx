"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "admin" | "author";

export type User = {
  id: string;
  name: string;
  role: UserRole;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  loginAsAdmin: () => void;
  loginAsAuthor: (id: string, name: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const KEY = "auth_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(KEY);
      if (raw) setUser(JSON.parse(raw));
      setLoading(false);
    }
  }, []);

  const save = (u: User | null) => {
    if (u) localStorage.setItem(KEY, JSON.stringify(u));
    else localStorage.removeItem(KEY);
    setUser(u);
  };

  const loginAsAdmin = () => {
    save({ id: "admin", name: "Admin", role: "admin" });
  };

  const loginAsAuthor = (id: string, name: string) => {
    save({ id, name, role: "author" });
  };

  const logout = () => save(null);

  return (
    <AuthContext.Provider
      value={{ user, loading, loginAsAdmin, loginAsAuthor, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
