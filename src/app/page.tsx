"use client";

/*
  UPDATED: Home page full
  - Restore 2 info panels
  - Bullet icons (SVG)
  - Stable showcase + responsive
*/

import styles from "@/styles/home.module.css";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getWorks } from "@/lib/workStore";
import { useInView } from "@/hooks/useInView";

type FeaturedWork = {
  id: string;
  title: string;
  hash: string;
  author: string;
  type: string;
};

export default function HomePage() {
  const sliderRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [works, setWorks] = useState<FeaturedWork[]>([]);

  /* LOAD + NORMALIZE WORKS */
  useEffect(() => {
    const rawWorks = getWorks()
      .filter((w: any) => w.status === "approved")
      .slice(0, 8);

    const normalized: FeaturedWork[] = rawWorks.map((w: any) => ({
      id: w.id,
      title: w.title || "Untitled Work",
      hash: w.hash || "",
      author: w.authorName || "Unknown author",
      type: w.type || "Digital Work",
    }));

    setWorks(normalized);
  }, []);

  /* AUTO SCROLL SLIDER */
  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;

    const start = () => {
      intervalRef.current = setInterval(() => {
        slider.scrollBy({ left: 280, behavior: "smooth" });

        if (
          slider.scrollLeft + slider.clientWidth >=
          slider.scrollWidth - 10
        ) {
          slider.scrollTo({ left: 0, behavior: "smooth" });
        }
      }, 3800);
    };

    const stop = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };

    start();
    slider.addEventListener("mouseenter", stop);
    slider.addEventListener("mouseleave", start);

    return () => {
      stop();
      slider.removeEventListener("mouseenter", stop);
      slider.removeEventListener("mouseleave", start);
    };
  }, []);

  const infoLeft = [
    "Ghi nhận quyền sở hữu tác phẩm âm nhạc",
    "Xác thực bản quyền minh bạch, rõ ràng",
    "Theo dõi quá trình sử dụng âm nhạc",
    "Ngăn chặn sao chép và sử dụng trái phép",
    "Hỗ trợ cấp phép và thu phí bản quyền",
  ];

  const infoRight = [
    "Bảo vệ quyền lợi hợp pháp của nghệ sĩ và nhà sản xuất",
    "Giảm thiểu vi phạm bản quyền và sao chép trái phép",
    "Tăng tính minh bạch trong quản lý và sử dụng âm nhạc",
    "Tạo nguồn thu ổn định từ bản quyền cho người sáng tạo",
    "Nâng cao ý thức tôn trọng bản quyền trong cộng đồng",
  ];

  return (
    <section className={styles.home}>
      {/* HERO */}
      <div className={styles.heroPanel}>
        <div className={styles.heroLeft}>
          <h1>
            Bảo vệ <span>tác phẩm số</span>
            <br />
            bằng Blockchain
          </h1>

          <p>
            Chainstorm là nền tảng đăng ký, xác thực và giao dịch quyền
            sở hữu trí tuệ minh bạch, không trung gian.
          </p>

          <div className={styles.heroActions}>
            <Link href="/register-work" className={styles.primaryBtn}>
              Đăng ký tác phẩm
            </Link>
            <Link href="/search" className={styles.ghostBtn}>
              Tra cứu
            </Link>
          </div>
        </div>

        <div className={styles.heroRight}>
          <img src="/images/hero.png" alt="Hero" />
        </div>
      </div>

      {/* FEATURED WORKS */}
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
          {works.map((work) => {
            const { ref, visible } = useInView<HTMLAnchorElement>();
            return (
              <Link
                key={work.id}
                ref={ref}
                href={`/work/${work.id}`}
                className={`${styles.workCard} ${
                  visible ? styles.show : ""
                }`}
              >
                <div className={styles.thumb}>
                  <span>{work.type}</span>
                </div>

                <h4>{work.title}</h4>

                <div className={styles.workMeta}>
                  <span className={styles.approved}>Approved</span>
                  <span className={styles.hash}>
                    {work.hash
                      ? `${work.hash.slice(0, 10)}…`
                      : "No hash"}
                  </span>
                </div>

                <span className={styles.author}>
                  {work.author}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* INFO PANELS */}
      <div className={styles.infoPanels}>
        <div className={styles.infoPanel}>
          <h3>Website Chainstorm dùng để làm gì?</h3>
          <ul>
            {infoLeft.map((item, i) => (
              <li key={i}>
                <span className={styles.bulletIcon}>
                  <svg viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.infoPanel}>
          <h3>Lợi ích khi sử dụng Chainstorm?</h3>
          <ul>
            {infoRight.map((item, i) => (
              <li key={i}>
                <span className={styles.bulletIcon}>
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2l7 4v6c0 5-3.5 9.5-7 10-3.5-.5-7-5-7-10V6l7-4z" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
