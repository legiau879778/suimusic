"use client";

import styles from "@/styles/permissionModal.module.css";
import { useModal } from "@/context/ModalContext";

export default function PermissionModal() {
  const { closePermission } = useModal();

  return (
    <div className={styles.backdrop} onClick={closePermission}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.icon}>
          <LockIcon />
        </div>

        <h2>Yêu cầu quyền tác giả</h2>

        <p>
          Chức năng này chỉ dành cho <b>Tác giả</b> đã
          đăng ký.
        </p>

        <p className={styles.sub}>
          Vui lòng kết nối ví và đăng ký tác giả để tiếp
          tục.
        </p>

        <button onClick={closePermission}>
          Đã hiểu
        </button>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fde047"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
