"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/styles/footer.module.css";

import {
  MapPin,
  Phone,
  EnvelopeSimple,
  TwitterLogo,
  MusicNotes,
  ShieldCheck,
  TiktokLogo, // ✅ NEW
} from "@phosphor-icons/react";

export default function Footer() {
  const ref = useRef<HTMLElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => e.isIntersecting && setShow(true),
      { threshold: 0.15 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <footer ref={ref} className={`${styles.footer} ${show ? styles.show : ""}`}>
      <div className={styles.inner}>
        <div className={styles.top}>
          {/* BRAND */}
          <div className={styles.brand}>
            <div className={styles.brandTitleRow}>
              <span className={styles.logoDot} aria-hidden="true">
                <MusicNotes weight="duotone" size={18} />
              </span>
              <h3 className={styles.title}>SUIMUSIC</h3>
            </div>

            <p className={styles.tagline}>
              Membership Music Copyright Model — đăng ký, xác thực và giao dịch bản quyền minh bạch
              trên blockchain.
            </p>

            <div className={styles.badges}>
              <span className={styles.pill}>
                <ShieldCheck weight="duotone" size={16} /> <strong>Verified</strong> on-chain
              </span>
              <span className={styles.pill}>Sui • NPT</span>
            </div>
          </div>

          {/* CONTACT */}
          <div className={styles.col}>
            <h4 className={styles.heading}>Liên hệ</h4>
            <ul className={styles.list}>
              <li className={styles.item}>
                <span className={styles.itemIcon} aria-hidden="true">
                  <MapPin weight="duotone" size={16} />
                </span>
                <span className={styles.itemText}>613 Âu Cơ, Phú Trung</span>
              </li>

              <li className={styles.item}>
                <span className={styles.itemIcon} aria-hidden="true">
                  <Phone weight="duotone" size={16} />
                </span>
                <span className={styles.itemText}>0918.924.576</span>
              </li>

              <li className={styles.item}>
                <span className={styles.itemIcon} aria-hidden="true">
                  <EnvelopeSimple weight="duotone" size={16} />
                </span>
                <span className={styles.itemText}>Di8494081@gmail.com</span>
              </li>
            </ul>
          </div>

          {/* SOCIAL */}
          <div className={styles.col}>
            <h4 className={styles.heading}>Social</h4>

            <div className={styles.links}>
              {/* Twitter / X */}
              <a
                href="https://x.com/SuiMusic_"
                target="_blank"
                rel="noreferrer"
                className={styles.link}
              >
                <span className={styles.linkIcon} aria-hidden="true">
                  <TwitterLogo weight="fill" size={16} />
                </span>
                Twitter / X
              </a>

              {/* ✅ TikTok */}
              <a
                href="https://www.tiktok.com/@suimusic" // đổi handle nếu cần
                target="_blank"
                rel="noreferrer"
                className={styles.link}
              >
                <span className={styles.linkIcon} aria-hidden="true">
                  <TiktokLogo weight="fill" size={16} />
                </span>
                TikTok
              </a>

              <div className={styles.hint}>
                Theo dõi để cập nhật sản phẩm, marketplace và các bản phát hành mới.
              </div>
            </div>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.bottom}>
          <div>© {new Date().getFullYear()} SUIMUSIC Copyright • All rights reserved</div>

          <div className={styles.bottomRight}>
            <a className={styles.miniLink} href="#">
              Terms
            </a>
            <a className={styles.miniLink} href="#">
              Privacy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
