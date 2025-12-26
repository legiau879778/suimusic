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

        <h2>Author Permission Required</h2>

        <p>
          This feature is only for registered <b>Authors</b>.
        </p>

        <p className={styles.sub}>
          Please connect your wallet and register as an author to continue.
        </p>

        <button onClick={closePermission}>
          Understood
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
