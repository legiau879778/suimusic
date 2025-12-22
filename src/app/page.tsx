import styles from "@/styles/home.module.css";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className={styles.page}>
      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.badge}>Web3 Copyright Registry</span>
          <h1 className={styles.title}>
            Bảo vệ & Giao dịch <br />
            <span>Bản quyền số</span>
          </h1>
          <p className={styles.subtitle}>
            Nền tảng đăng ký, xác thực và giao dịch bản quyền minh bạch
            trên blockchain.
          </p>

          <div className={styles.heroActions}>
            <Link href="/search" className={styles.primaryBtn}>
              Tra cứu tác phẩm
            </Link>
            <Link href="/register-work" className={styles.secondaryBtn}>
              Đăng ký tác phẩm
            </Link>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.glowCircle} />
          <div className={styles.mockCard}>
            <h4>Digital Artwork #A19</h4>
            <p>Hash: 0x9f3c…82ea</p>
            <span className={styles.verified}>✔ Verified</span>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>Tính năng cốt lõi</h2>

        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <div className={styles.icon}>🛡️</div>
            <h3>Đăng ký bản quyền</h3>
            <p>
              Lưu hash tác phẩm lên blockchain, chống giả mạo,
              minh bạch và toàn cầu.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.icon}>👥</div>
            <h3>Duyệt đa quản trị</h3>
            <p>
              Cơ chế multi-admin, trọng số duyệt, tăng độ tin cậy.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.icon}>🔗</div>
            <h3>Giao dịch on-chain</h3>
            <p>
              Mua bán bản quyền trực tiếp, lịch sử giao dịch rõ ràng.
            </p>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className={styles.stats}>
        <div className={styles.stat}>
          <strong>1,200+</strong>
          <span>Tác phẩm đăng ký</span>
        </div>
        <div className={styles.stat}>
          <strong>340+</strong>
          <span>Tác giả</span>
        </div>
        <div className={styles.stat}>
          <strong>98%</strong>
          <span>Độ tin cậy</span>
        </div>
      </section>
    </main>
  );
}
