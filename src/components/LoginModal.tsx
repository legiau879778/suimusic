"use client";

import { useAuth } from "@/context/AuthContext";
import { useModal } from "@/context/ModalContext";
import styles from "@/styles/loginModal.module.css";

export default function LoginModal() {
  const { loginWithGoogle } = useAuth();
  const { closeLogin } = useModal();

  return (
    <div className={styles.modal}>
      <h2>Đăng nhập</h2>

      <button
        className={styles.google}
        onClick={() => {
          loginWithGoogle();
          closeLogin();
        }}
      >
        Đăng nhập bằng Google
      </button>
    </div>
  );
}
