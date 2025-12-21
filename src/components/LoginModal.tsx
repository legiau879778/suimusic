"use client";

import styles from "@/styles/loginModal.module.css";
import { signIn } from "next-auth/react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function LoginModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Đăng nhập</h3>

        <button
          className={styles.primary}
          onClick={() => signIn("google")}
        >
          Đăng nhập với Google
        </button>

        <div className={styles.divider}>hoặc</div>

        <button className={styles.wallet}>
          Kết nối Wallet (coming soon)
        </button>

        <button className={styles.close} onClick={onClose}>
          Để sau
        </button>
      </div>
    </div>
  );
}
