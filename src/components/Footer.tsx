"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/styles/footer.module.css";

export default function Footer() {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => e.isIntersecting && setShow(true),
      { threshold: 0.2 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <footer
      ref={ref}
      className={`${styles.footer} ${
        show ? styles.show : ""
      }`}
    >
      <div className={styles.grid}>
        {/* BRAND */}
        <div>
          <h3 className={styles.title}>
            SUMUSIC
          </h3>
          <p className={styles.desc}>
            Membership Music Copyright Model
          </p>
        </div>

        {/* CONTACT */}
        <div>
          <h4 className={styles.heading}>
            Thông tin liên hệ
          </h4>
          <p>📍 613 Âu Cơ, Phú Trung</p>
          <p>📞 0918.924.576</p>
          <p>✉️ Di8494081@gmail.com</p>
        </div>

        {/* SOCIAL */}
        <div>
          <h4 className={styles.heading}>
            Social
          </h4>
          <a
            href="https://x.com/SuiMusic_"
            target="_blank"
            className={styles.social}
          >
            <XIcon /> Twitter
          </a>
        </div>
      </div>

      <div className={styles.copy}>
        © {new Date().getFullYear()} SUMUSIC
      </div>
    </footer>
  );
}

/* X ICON */
function XIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M18.9 2H22l-6.6 7.5L23 22h-6.8l-5.3-7-6.1 7H2l7.1-8.1L1 2h7l4.8 6.3L18.9 2z" />
    </svg>
  );
}
