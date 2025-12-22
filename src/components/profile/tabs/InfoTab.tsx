"use client";

import styles from "@/styles/profile.module.css";
import { useAuth } from "@/context/AuthContext";

export default function InfoTab() {
  const { user } = useAuth();

  return (
    <div className={styles.infoGrid}>
      {/* ===== LEFT: PERSONAL INFO ===== */}
      <section className={styles.card}>
        <h2>Thông tin cá nhân</h2>

        <div className={styles.formGrid}>
          <div className={styles.formField}>
            <label>Họ và tên</label>
            <input placeholder="Nhập họ tên" />
          </div>

          <div className={styles.formField}>
            <label>Ngày sinh</label>
            <input type="date" />
          </div>

          <div className={styles.formField}>
            <label>Quốc gia</label>
            <input />
          </div>

          <div className={styles.formField}>
            <label>Căn cước công dân</label>
            <input />
          </div>

          <div className={styles.formField}>
            <label>SĐT</label>
            <input />
          </div>

          <div className={styles.formField}>
            <label>Email</label>
            <input value={user?.email || ""} disabled />
          </div>

          <div className={styles.formFieldFull}>
            <label>Địa chỉ</label>
            <input />
          </div>
        </div>
      </section>

      {/* ===== RIGHT: WALLET ===== */}
      <section className={styles.card}>
        <h2>Số địa chỉ ví Blockchain SUI</h2>

        <div className={styles.walletBox}>
          <label>Địa chỉ ví</label>
          <input
            value="0x0000...abcd"
            disabled
          />

          <div className={styles.balanceBox}>
            <span>Số dư hiện tại</span>
            <strong>25 $</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
