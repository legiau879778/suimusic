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
              Protect &amp; Trade <br />
              <span>Digital music copyrights</span>
            </h1>

            <p className={styles.subtitle}>Protect your music with the power of Blockchain.</p>

            <div className={styles.heroActions}>
              <Link href="/register-work" className={styles.primaryBtn}>
                Register Work
              </Link>
              <Link href="/search" className={styles.secondaryBtn}>
                Search Work
              </Link>
            </div>

            {/* 2 INFO PILL */}
            <div className={styles.infoRow}>
              <div className={styles.infoPill}>
                <div className={styles.infoIcon}>🔒</div>
                <div className={styles.infoText}>
                  <div className={styles.infoTop}>On-chain Proof</div>
                  <div className={styles.infoBot}>Transparent Hash + Ownership</div>
                </div>
              </div>

              <div className={styles.infoPill}>
                <div className={styles.infoIcon}>⚡</div>
                <div className={styles.infoText}>
                  <div className={styles.infoTop}>Fast Verify</div>
                  <div className={styles.infoBot}>Instant Search &amp; Verification</div>
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
          <h2 className={styles.sectionTitle}>Core Features</h2>
          <p className={styles.sectionSub}>
            Core functions that make your protection and trading safe.
          </p>
        </div>

        <div className={styles.featureGridV2}>
          <Link href="/register-work" className={`${styles.featureCardV2} ${styles.glowYellow}`}>
            <div className={styles.featureIconWrap}>
              <FileText weight="duotone" className={styles.featureIconSvg} />
            </div>
            <div className={styles.featureBodyV2}>
              <div className={styles.featureBrand}>SUIMUSIC</div>
              <div className={styles.featureTitleV2}>Register work</div>
              <div className={styles.featureSubV2}>Record work ownership on-chain</div>
            </div>
          </Link>

          <Link href="/manage" className={`${styles.featureCardV2} ${styles.glowGreen}`}>
            <div className={styles.featureIconWrap}>
              <ShieldCheck weight="duotone" className={styles.featureIconSvg} />
            </div>
            <div className={styles.featureBodyV2}>
              <div className={styles.featureBrand}>SUIMUSIC</div>
              <div className={styles.featureTitleV2}>Manage copyrights</div>
              <div className={styles.featureSubV2}>Track status, ownership and licenses</div>
            </div>
          </Link>

          <Link href="/search" className={`${styles.featureCardV2} ${styles.glowCyan}`}>
            <div className={styles.featureIconWrap}>
              <MagnifyingGlass weight="duotone" className={styles.featureIconSvg} />
            </div>
            <div className={styles.featureBodyV2}>
              <div className={styles.featureBrand}>SUIMUSIC</div>
              <div className={styles.featureTitleV2}>Search works</div>
              <div className={styles.featureSubV2}>Verify origin &amp; ownership instantly</div>
            </div>
          </Link>

          <Link href="/marketplace" className={`${styles.featureCardV2} ${styles.glowPurple}`}>
            <div className={styles.featureIconWrap}>
              <Coins weight="duotone" className={styles.featureIconSvg} />
            </div>
            <div className={styles.featureBodyV2}>
              <div className={styles.featureBrand}>SUIMUSIC</div>
              <div className={styles.featureTitleV2}>Trade copyrights</div>
              <div className={styles.featureSubV2}>Buy &amp; issue licenses transparently on-chain</div>
            </div>
          </Link>
        </div>
      </section>

      {/* STATS */}
      <section className={styles.stats}>
        <div className={styles.stat}>
          <strong>8,000+</strong>
          <span>Protected works</span>
        </div>
        <div className={styles.stat}>
          <strong>700+</strong>
          <span>Traded works</span>
        </div>
        <div className={styles.stat}>
          <strong>98%</strong>
          <span>Reliability</span>
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
              <h3 className={styles.infoBlockTitle}>What is Chainstorm website used for?</h3>
            </div>

            <ul className={styles.infoList}>
              <li className={styles.infoLine}>Record ownership of musical works</li>
              <li className={styles.infoLine}>Transparent and clear copyright verification</li>
              <li className={styles.infoLine}>Track and manage music usage</li>
              <li className={styles.infoLine}>Prevent copying and unauthorized use</li>
              <li className={styles.infoLine}>Support licensing and copyright fee collection</li>
            </ul>
          </div>

          <div className={styles.infoBlock}>
            <div className={styles.infoHead}>
              <span className={styles.infoHeadIcon}>
                <Sparkle weight="duotone" size={18} />
              </span>
              <h3 className={styles.infoBlockTitle}>Benefits of using Chainstorm?</h3>
            </div>

            <ul className={styles.infoList}>
              <li className={styles.infoLine}>Protect the legal rights of artists and producers</li>
              <li className={styles.infoLine}>Minimize copyright infringement and unauthorized copying</li>
              <li className={styles.infoLine}>Increase transparency in music management and usage</li>
              <li className={styles.infoLine}>Create stable revenue from copyrights for creators</li>
              <li className={styles.infoLine}>Enhance copyright respect awareness in the community</li>
            </ul>
          </div>
        </div>
      </section>


      {/* BACK TO TOP + PROGRESS */}
      <button
        className={`${styles.backToTop} ${showTop ? styles.backToTopShow : ""}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        title="Go to top"
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
