import styles from "@/styles/home.module.css";
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className={styles.wrapper}>
      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <h1 className={styles.title}>
            Bảo vệ âm nhạc của bạn <br />
            <span>Bằng sức mạnh Blockchain</span>
          </h1>

          <div className={styles.buttons}>
            <Link href="/register-work" className={styles.primaryBtn}>
              Đăng ký bản quyền
            </Link>
            <Link href="/search" className={styles.outlineBtn}>
              Tra cứu
            </Link>
          </div>

          <div className={styles.stats}>
            <div>
              <strong>8000+</strong>
              <p>Tác phẩm đã được bảo vệ</p>
            </div>
            <div>
              <strong>5000+</strong>
              <p>Tác phẩm đã được giao dịch</p>
            </div>
            <div>
              <strong>1000+</strong>
              <p>Nghệ sĩ tin dùng</p>
            </div>
          </div>
        </div>

        <div className={styles.heroRight}>
          <Image
            src="/images/hero-guitar.png"
            alt="Blockchain music"
            width={420}
            height={420}
          />
        </div>
      </section>

      {/* FEATURE CARDS */}
      <section className={styles.features}>
        <Feature
          title="Đăng ký tác phẩm"
          desc="Ghi nhận bản quyền tác phẩm của bạn"
        />
        <Feature
          title="Quản lí tác phẩm"
          desc="Theo dõi và quản lý quyền sở hữu"
        />
        <Feature
          title="Tra cứu tác phẩm"
          desc="Kiểm tra bản quyền minh bạch"
        />
        <Feature
          title="Giao dịch"
          desc="Mua bán bản quyền an toàn"
        />
      </section>

      {/* INFO */}
      <section className={styles.info}>
        <div className={styles.infoBox}>
          <h3>Website Chainstorm dùng để làm gì?</h3>
          <ul>
            <li>Ghi nhận quyền sở hữu tác phẩm âm nhạc</li>
            <li>Xác thực bản quyền minh bạch, rõ ràng</li>
            <li>Theo dõi và quản lý việc sử dụng âm nhạc</li>
            <li>Ngăn chặn sao chép và sử dụng trái phép</li>
            <li>Hỗ trợ cấp phép và thu phí bản quyền</li>
          </ul>
        </div>

        <div className={styles.infoBox}>
          <h3>Lợi ích khi sử dụng Chainstorm?</h3>
          <ul>
            <li>Bảo vệ quyền lợi nghệ sĩ và nhà sản xuất</li>
            <li>Giảm thiểu vi phạm bản quyền</li>
            <li>Tăng tính minh bạch trong giao dịch</li>
            <li>Tạo nguồn thu ổn định từ bản quyền</li>
            <li>Nâng cao ý thức tôn trọng bản quyền</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function Feature({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className={styles.featureCard}>
      <h4>{title}</h4>
      <p>{desc}</p>
    </div>
  );
}
