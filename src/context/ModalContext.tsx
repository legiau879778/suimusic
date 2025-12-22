"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import LoginPanel from "@/components/auth/LoginPanel";
import PermissionModal from "@/components/PermissionModal";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";

type ModalContextType = {
  openLogin: () => void;
  closeLogin: () => void;
  openPermission: () => void;
  closePermission: () => void;
};

const ModalContext = createContext<ModalContextType>(
  {} as ModalContextType
);

export function ModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [loginOpen, setLoginOpen] = useState(false);
  const [permissionOpen, setPermissionOpen] =
    useState(false);

  const [closing, setClosing] = useState<
    "login" | "permission" | null
  >(null);

  /* ========= AUTO CLOSE MODAL KHI LOGIN ========= */
  useEffect(() => {
    if (!user) return;

    // animate đóng
    if (loginOpen) {
      setClosing("login");
      setTimeout(() => {
        setLoginOpen(false);
        setClosing(null);
      }, 180);
    }

    // đóng permission modal nếu user có role cao hơn
    if (
      permissionOpen &&
      (user.role === "author" ||
        user.role === "admin")
    ) {
      setClosing("permission");
      setTimeout(() => {
        setPermissionOpen(false);
        setClosing(null);
      }, 180);
    }

    /* AUTO REDIRECT SAU LOGIN */
    if (pathname === "/login") {
      router.replace("/");
    }
  }, [user]);

  return (
    <ModalContext.Provider
      value={{
        openLogin: () => setLoginOpen(true),
        closeLogin: () => setLoginOpen(false),
        openPermission: () =>
          setPermissionOpen(true),
        closePermission: () =>
          setPermissionOpen(false),
      }}
    >
      {children}

      {/* LOGIN MODAL */}
      {loginOpen && (
        <div
          className={`modalOverlay ${
            closing === "login"
              ? "closing"
              : ""
          }`}
          onClick={() => setLoginOpen(false)}
        >
          <div
            className="modalInner"
            onClick={(e) => e.stopPropagation()}
          >
            <LoginPanel />
          </div>
        </div>
      )}

      {/* PERMISSION MODAL */}
      {permissionOpen && (
        <div
          className={`modalOverlay ${
            closing === "permission"
              ? "closing"
              : ""
          }`}
        >
          <PermissionModal />
        </div>
      )}
    </ModalContext.Provider>
  );
}

export const useModal = () => useContext(ModalContext);
