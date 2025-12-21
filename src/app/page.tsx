import styles from "@/styles/home.module.css";
import Link from "next/link";

const cards = [
  { title: "Đăng ký tác phẩm", desc: "Đăng ký bản quyền", icon: "/icons/register.png", href: "/register-work" },
  { title: "Quản lý tác phẩm", desc: "Quản lý bản quyền", icon: "/icons/manage.png", href: "/manage" },
  { title: "Tra cứu tác phẩm", desc: "Xác thực bản quyền", icon: "/icons/search.png", href: "/search" },
  { title: "Giao dịch bản quyền", desc: "Mua bán bản quyền", icon: "/icons/trade.png", href: "/market" },
];

export default function HomePage() {
  return (
    <div className={styles.wrapper}>
      <section className={styles.glassContainer}>
        <div className={styles.hero}>
          <div className={styles.heroLeft}>
            <div className={styles.brand}>CHAINSTORM</div>

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
                <p>Tác phẩm được bảo vệ</p>
              </div>
              <div>
                <strong>5000+</strong>
                <p>Giao dịch bản quyền</p>
              </div>
              <div>
                <strong>1000+</strong>
                <p>Nghệ sĩ tin dùng</p>
              </div>
            </div>
          </div>

          {/* SLIDER */}
          <div className={styles.slider}>
            <div className={styles.track}>
              {[...cards, ...cards].map((c, i) => (
                <Link
                  key={i}
                  href={c.href}
                  className={styles.card}
                  style={{ ["--logo" as any]: `url(${c.icon})` }}
                >
                  <h4>{c.title}</h4>
                  <p>{c.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* INFO */}
        <div className={styles.info}>
          <div className={styles.infoBox}>
            <h3>Website Chainstorm dùng để làm gì?</h3>
            <ul>
              <li>Ghi nhận quyền sở hữu tác phẩm âm nhạc</li>
              <li>Xác thực bản quyền minh bạch</li>
              <li>Theo dõi và quản lý việc sử dụng</li>
              <li>Ngăn chặn sao chép trái phép</li>
              <li>Thu phí và cấp phép bản quyền</li>
            </ul>
          </div>

          <div className={styles.infoBox}>
            <h3>Lợi ích khi sử dụng Chainstorm?</h3>
            <ul>
              <li>Bảo vệ quyền lợi nghệ sĩ</li>
              <li>Giảm vi phạm bản quyền</li>
              <li>Tăng minh bạch</li>
              <li>Tạo nguồn thu ổn định</li>
              <li>Nâng cao ý thức cộng đồng</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
