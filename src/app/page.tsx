"use client";

import styles from "@/styles/home.module.css";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  FileText,
  ShieldCheck,
  MagnifyingGlass,
  Coins,
  ArrowUp,
} from "@phosphor-icons/react";
import { Info, Sparkle } from "@phosphor-icons/react"; 

export default function HomePage() {
  const demoId = "a19";

  const [showTop, setShowTop] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0;
      setShowTop(y > 400);

      const doc = document.documentElement;
      const scrollTop = doc.scrollTop || 0;
      const scrollHeight = doc.scrollHeight || 0;
      const clientHeight = doc.clientHeight || 0;
      const max = Math.max(1, scrollHeight - clientHeight);
      const p = Math.min(1, Math.max(0, scrollTop / max));
      setProgress(p);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className={styles.page}>
      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroShell}>
          <div className={styles.heroContent}>
            <span className={styles.badge}>SUIMUSIC: Membership Music Copyright</span>

            <h1 className={styles.title}>
              Bảo vệ &amp; Giao dịch <br />
              <span>Bản quyền âm nhạc số</span>
            </h1>

            <p className={styles.subtitle}>Bảo vệ âm nhạc của bạn bằng sức mạnh Blockchain.</p>

            <div className={styles.heroActions}>
              <Link href="/register-work" className={styles.primaryBtn}>
                Đăng ký tác phẩm
              </Link>
              <Link href="/search" className={styles.secondaryBtn}>
                Tra cứu tác phẩm
              </Link>
            </div>

            {/* 2 INFO PILL */}
            <div className={styles.infoRow}>
              <div className={styles.infoPill}>
                <div className={styles.infoIcon}>🔒</div>
                <div className={styles.infoText}>
                  <div className={styles.infoTop}>On-chain Proof</div>
                  <div className={styles.infoBot}>Hash + Ownership minh bạch</div>
                </div>
              </div>

              <div className={styles.infoPill}>
                <div className={styles.infoIcon}>⚡</div>
                <div className={styles.infoText}>
                  <div className={styles.infoTop}>Fast Verify</div>
                  <div className={styles.infoBot}>Tra cứu &amp; xác thực tức thì</div>
                </div>
              </div>
            </div>
          </div>

          {/* NFT PREVIEW */}
          <Link
            href={`/marketplace/${demoId}`}
            className={styles.nftPreview}
            aria-label="View NFT"
          >
            <div className={styles.nftVisual}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.nftImg} src="/images/suimusic.png" alt="NFT preview" />

              <div className={styles.nftGrid} />
              <div className={styles.nftGloss} />
              <div className={styles.nftShimmer} />

              <div className={styles.nftBadges}>
                <span className={styles.verifiedBadge}>
                  <span className={styles.dog}>🐶</span> Verified
                </span>
                <span className={styles.chainBadge}>Sui</span>
              </div>

              <div className={styles.nftHoverCta}>View NFT →</div>
            </div>

            <div className={styles.nftBody}>
              <div className={styles.nftTopRow}>
                <div className={styles.nftTitle}>SUIMUSIC #MMC</div>
                <div className={styles.nftPrice}>1.000 SUI</div>
              </div>

              <div className={styles.nftMeta}>
                <div className={styles.nftMetaRow}>
                  <span className={styles.metaK}>Hash</span>
                  <span className={styles.metaV}>0x9f3c…82ea</span>
                </div>
                <div className={styles.nftMetaRow}>
                  <span className={styles.metaK}>Owner</span>
                  <span className={styles.metaV}>0x12ab…9cde</span>
                </div>
                <div className={styles.nftMetaRow}>
                  <span className={styles.metaK}>Royalty</span>
                  <span className={styles.metaV}>10%</span>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* FEATURES (PHOSPHOR) */}
      <section className={styles.features}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Tính năng cốt lõi</h2>
          <p className={styles.sectionSub}>
            Những chức năng trọng tâm giúp bảo vệ và giao dịch của bạn trở nên an toàn.
          </p>
        </div>

        <div className={styles.featureGridV2}>
          <Link href="/register-work" className={`${styles.featureCardV2} ${styles.glowYellow}`}>
            <div className={styles.featureIconWrap}>
              <FileText weight="duotone" className={styles.featureIconSvg} />
            </div>
            <div className={styles.featureBodyV2}>
              <div className={styles.featureBrand}>SUIMUSIC</div>
              <div className={styles.featureTitleV2}>Đăng ký tác phẩm</div>
              <div className={styles.featureSubV2}>Ghi nhận quyền sở hữu tác phẩm on-chain</div>
            </div>
          </Link>

          <Link href="/manage" className={`${styles.featureCardV2} ${styles.glowGreen}`}>
            <div className={styles.featureIconWrap}>
              <ShieldCheck weight="duotone" className={styles.featureIconSvg} />
            </div>
            <div className={styles.featureBodyV2}>
              <div className={styles.featureBrand}>SUIMUSIC</div>
              <div className={styles.featureTitleV2}>Quản lý bản quyền</div>
              <div className={styles.featureSubV2}>Theo dõi trạng thái, ownership và license</div>
            </div>
          </Link>

          <Link href="/search" className={`${styles.featureCardV2} ${styles.glowCyan}`}>
            <div className={styles.featureIconWrap}>
              <MagnifyingGlass weight="duotone" className={styles.featureIconSvg} />
            </div>
            <div className={styles.featureBodyV2}>
              <div className={styles.featureBrand}>SUIMUSIC</div>
              <div className={styles.featureTitleV2}>Tra cứu tác phẩm</div>
              <div className={styles.featureSubV2}>Xác thực nguồn gốc &amp; quyền sở hữu tức thì</div>
            </div>
          </Link>

          <Link href="/marketplace" className={`${styles.featureCardV2} ${styles.glowPurple}`}>
            <div className={styles.featureIconWrap}>
              <Coins weight="duotone" className={styles.featureIconSvg} />
            </div>
            <div className={styles.featureBodyV2}>
              <div className={styles.featureBrand}>SUIMUSIC</div>
              <div className={styles.featureTitleV2}>Giao dịch bản quyền</div>
              <div className={styles.featureSubV2}>Mua bán &amp; cấp license minh bạch on-chain</div>
            </div>
          </Link>
        </div>
      </section>

      {/* STATS */}
      <section className={styles.stats}>
        <div className={styles.stat}>
          <strong>8,000+</strong>
          <span>Tác phẩm được bảo vệ</span>
        </div>
        <div className={styles.stat}>
          <strong>700+</strong>
          <span>Tác phẩm được giao dịch</span>
        </div>
        <div className={styles.stat}>
          <strong>98%</strong>
          <span>Độ tin cậy</span>
        </div>
      </section>

      {/* INFO BLOCKS */}
      <section className={styles.infoBlocksWrap}>
        <div className={styles.infoBlocks}>
          <div className={styles.infoBlock}>
            <div className={styles.infoHead}>
              <span className={styles.infoHeadIcon}>
                <Info weight="duotone" size={18} />
              </span>
              <h3 className={styles.infoBlockTitle}>Website Chainstorm dùng để làm gì?</h3>
            </div>

            <ul className={styles.infoList}>
              <li className={styles.infoLine}>Ghi nhận quyền sở hữu tác phẩm âm nhạc</li>
              <li className={styles.infoLine}>Xác thực bản quyền minh bạch, rõ ràng</li>
              <li className={styles.infoLine}>Theo dõi và quản lý việc sử dụng âm nhạc</li>
              <li className={styles.infoLine}>Ngăn chặn sao chép và sử dụng trái phép</li>
              <li className={styles.infoLine}>Hỗ trợ cấp phép và thu phí bản quyền</li>
            </ul>
          </div>

          <div className={styles.infoBlock}>
            <div className={styles.infoHead}>
              <span className={styles.infoHeadIcon}>
                <Sparkle weight="duotone" size={18} />
              </span>
              <h3 className={styles.infoBlockTitle}>Lợi ích khi sử dụng Chainstorm?</h3>
            </div>

            <ul className={styles.infoList}>
              <li className={styles.infoLine}>Bảo vệ quyền lợi hợp pháp của nghệ sĩ và nhà sản xuất</li>
              <li className={styles.infoLine}>Giảm thiểu vi phạm bản quyền và sao chép trái phép</li>
              <li className={styles.infoLine}>Tăng tính minh bạch trong quản lý và sử dụng âm nhạc</li>
              <li className={styles.infoLine}>Tạo nguồn thu ổn định từ bản quyền cho người sáng tạo</li>
              <li className={styles.infoLine}>Nâng cao ý thức tôn trọng bản quyền trong cộng đồng</li>
            </ul>
          </div>
        </div>
      </section>


      {/* BACK TO TOP + PROGRESS */}
      <button
        className={`${styles.backToTop} ${showTop ? styles.backToTopShow : ""}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        title="Lên đầu trang"
      >
        <svg className={styles.progressRing} viewBox="0 0 44 44" aria-hidden="true">
          <circle className={styles.progressTrack} cx="22" cy="22" r="18" />
          <circle
            className={styles.progressValue}
            cx="22"
            cy="22"
            r="18"
            style={{
              strokeDasharray: `${2 * Math.PI * 18}`,
              strokeDashoffset: `${(1 - progress) * (2 * Math.PI * 18)}`,
            }}
          />
        </svg>

        <span className={styles.topIcon}>
          <ArrowUp weight="bold" size={18} />
        </span>
      </button>
    </main>
  );
}
