"use client";

import styles from "@/styles/home.module.css";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { getWorks } from "@/lib/workStore";
import WorkThumbnail from "@/components/WorkThumbnail";
import FeatureIcon from "@/components/FeatureIcon";
import { useReveal } from "@/hooks/useReveal";
import { BLUR_HERO } from "@/lib/blur";
import { useLoginModal } from "@/context/LoginModalContext";
import { useSession } from "next-auth/react";

type FeaturedWork = {
  id: string;
  title: string;
  hash: string;
  author: string;
  type: string;
  image?: string;
};

export default function HomePage() {
  const { data: session } = useSession();
  const { openLogin } = useLoginModal();

  const sliderRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [works, setWorks] = useState<FeaturedWork[]>([]);

  /* ================= LOAD WORKS ================= */
  useEffect(() => {
    const raw = getWorks()
      .filter((w: any) => w.status === "approved")
      .slice(0, 8);

    setWorks(
      raw.map((w: any) => ({
        id: w.id,
        title: w.title || "Untitled Work",
        hash: w.hash || "",
        author: w.authorName || "Unknown author",
        type: w.type || "Digital Work",
        image: w.image,
      }))
    );
  }, []);

  /* ================= AUTO SCROLL SLIDER ================= */
  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;

    intervalRef.current = setInterval(() => {
      slider.scrollBy({ left: 280, behavior: "smooth" });

      if (
        slider.scrollLeft + slider.clientWidth >=
        slider.scrollWidth - 10
      ) {
        slider.scrollTo({ left: 0, behavior: "smooth" });
      }
    }, 3800);

    return () =>
      intervalRef.current && clearInterval(intervalRef.current);
  }, []);

  /* ================= FEATURE CONFIG ================= */
  const features = [
    {
      type: "register",
      title: "Đăng ký tác phẩm",
      desc: "Ghi nhận quyền sở hữu tác phẩm",
      href: "/register-work",
      private: true,
    },
    {
      type: "manage",
      title: "Quản lý tác phẩm",
      desc: "Bảo vệ và quản lý bản quyền",
      href: "/manage",
      private: true,
    },
    {
      type: "search",
      title: "Tra cứu tác phẩm",
      desc: "Kiểm tra tính hợp lệ bản quyền",
      href: "/search",
      private: false,
    },
    {
      type: "trade",
      title: "Giao dịch",
      desc: "Mua bán và cấp phép bản quyền",
      href: "/trade",
      private: true,
    },
  ];

  const infoLeft = [
    "Ghi nhận quyền sở hữu tác phẩm âm nhạc",
    "Xác thực bản quyền minh bạch, rõ ràng",
    "Theo dõi quá trình sử dụng âm nhạc",
    "Ngăn chặn sao chép và sử dụng trái phép",
    "Hỗ trợ cấp phép và thu phí bản quyền",
  ];

  const infoRight = [
    "Bảo vệ quyền lợi hợp pháp của nghệ sĩ",
    "Giảm thiểu vi phạm bản quyền",
    "Tăng tính minh bạch trong quản lý",
    "Tạo nguồn thu bền vững",
    "Nâng cao ý thức cộng đồng",
  ];

  return (
    <section className={styles.home}>
      {/* ================= HERO ================= */}
      <div className={styles.heroWrapper}>
        <div className={styles.heroPanel}>
          <div className={styles.heroLeft}>
            <span className={styles.badge}>Chainstorm</span>

            <h1>
              Bảo vệ âm nhạc của bạn
              <br />
              <span>Bằng sức mạnh Blockchain</span>
            </h1>

            <p>
              Nền tảng đăng ký, xác thực và giao dịch bản quyền
              âm nhạc minh bạch – phi tập trung.
            </p>

            <div className={styles.heroActions}>
              <Link href="/register-work" className={styles.primaryBtn}>
                Đăng ký bản quyền
              </Link>
              <Link href="/search" className={styles.ghostBtn}>
                Tra cứu
              </Link>
            </div>
          </div>

          <div className={styles.heroRight}>
            <Image
              src="/images/hero.png"
              alt="Chainstorm Hero"
              width={520}
              height={420}
              priority
              placeholder="blur"
              blurDataURL={BLUR_HERO}
            />
          </div>
        </div>
      </div>

      {/* ================= FEATURE CARDS ================= */}
      <div className={styles.features}>
        {features.map((f, i) => {
          const { ref, show } = useReveal<HTMLDivElement>();
          const disabled = f.private && !session;

          return (
            <div
              key={f.type}
              ref={ref}
              className={`${styles.featureCard} ${
                show ? styles.show : ""
              } ${disabled ? styles.featureDisabled : ""}`}
              style={{ transitionDelay: `${i * 80}ms` }}
              onClick={() => {
                if (disabled) openLogin();
              }}
            >
              <div className={styles.icon}>
                <FeatureIcon
                  type={f.type as any}
                  active={show && !disabled}
                />
              </div>

              <h4>{f.title}</h4>
              <p>{f.desc}</p>

              {!disabled && (
                <Link href={f.href} className={styles.coverLink} />
              )}

              {disabled && (
                <span className={styles.lock}>
                  🔒
                  <span className={styles.tooltip}>
                    Cần đăng nhập để sử dụng
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ================= FEATURED WORKS ================= */}
      <div className={styles.sliderPanel}>
        <div className={styles.sliderHeader}>
          <div>
            <h2>Tác phẩm nổi bật</h2>
            <p>Những tác phẩm đã được xác thực bản quyền</p>
          </div>

          <Link href="/search" className={styles.more}>
            Xem tất cả →
          </Link>
        </div>

        <div className={styles.slider} ref={sliderRef}>
          {works.map((work) => (
            <Link
              key={work.id}
              href={`/work/${work.id}`}
              className={styles.workCard}
            >
              <WorkThumbnail src={work.image} label={work.type} />

              <h4>{work.title}</h4>

              <div className={styles.workMeta}>
                <span className={styles.approved}>Approved</span>
                <span className={styles.hash}>
                  {work.hash
                    ? `${work.hash.slice(0, 10)}…`
                    : "No hash"}
                </span>
              </div>

              <span className={styles.author}>{work.author}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ================= INFO PANELS (KHÔNG ĐƯỢC MẤT) ================= */}
      <div className={styles.infoPanels}>
        <div className={styles.infoPanel}>
          <h3>Website Chainstorm dùng để làm gì?</h3>
          <ul>
            {infoLeft.map((i, idx) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        </div>

        <div className={styles.infoPanel}>
          <h3>Lợi ích khi sử dụng Chainstorm?</h3>
          <ul>
            {infoRight.map((i, idx) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
