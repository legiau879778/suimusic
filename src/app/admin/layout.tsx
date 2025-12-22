"use client";

import AdminSidebar from "@/components/admin/AdminSidebar";
import styles from "@/styles/admin/layout.module.css";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user || (user.role !== "admin")) {
      router.replace("/");
    }
  }, [user]);

  return (
    <div className={styles.layout}>
      <AdminSidebar />
      <div className={styles.main}>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
