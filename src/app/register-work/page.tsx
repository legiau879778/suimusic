"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  addWork,
  type MarketStatus as WorkMarketStatus,
} from "@/lib/workStore";
import styles from "@/app/register-work/registWork.module.css";

/* ================= TYPES ================= */

// UI chỉ dùng cho form
type Step = 1 | 2 | 3;
type MarketStatusUI = "private" | "public" | "pending";

/* ================= COMPONENT ================= */

export default function RegisterWorkPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);

  /* ===== BASIC ===== */
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("vi");
  const [completedAt, setCompletedAt] = useState("");

  const [fileName, setFileName] = useState("");
  const [hash, setHash] = useState("");
  const [duration, setDuration] = useState<number | null>(null);

  const [marketStatus, setMarketStatus] =
    useState<MarketStatusUI>("private");

  /* ===== STEP 3 MOCK ===== */
  const [ipfsCid, setIpfsCid] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  /* ===== AUTH ===== */
  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  if (!user) return null;

  // 🔥 SNAPSHOT non-null cho TypeScript
  const authorId: string = user.id;

  /* ================= HELPERS ================= */

  function generateHash() {
    setHash(crypto.randomUUID().replace(/-/g, ""));
  }

  function readDuration(file: File) {
    const url = URL.createObjectURL(file);
    const media = document.createElement(
      file.type.startsWith("audio") ? "audio" : "video"
    );
    media.src = url;
    media.onloadedmetadata = () => {
      setDuration(media.duration);
      URL.revokeObjectURL(url);
    };
  }

  /* ================= VALIDATION ================= */

  const step1Valid =
    !!(
      title &&
      genre &&
      language &&
      completedAt &&
      fileName &&
      hash
    );

  /* ================= MOCK ACTIONS ================= */

  async function uploadIPFS() {
    await new Promise((r) => setTimeout(r, 1200));
    setIpfsCid(
      "ipfs://bafy" +
        Math.random().toString(36).slice(2)
    );
  }

  async function registerOnChain() {
    await new Promise((r) => setTimeout(r, 1200));
    setTxHash(
      "0x" + Math.random().toString(16).slice(2)
    );
  }

  /* ================= MAP UI → DOMAIN ================= */

  function mapMarketStatus(
    ui: MarketStatusUI
  ): WorkMarketStatus {
    switch (ui) {
      case "public":
        return "public";
      case "private":
        return "private";
      case "pending":
      default:
        // pending chỉ là UI, chưa public
        return "private";
    }
  }

  /* ================= FINAL SUBMIT ================= */

  function finish() {
    const finalMarketStatus =
      mapMarketStatus(marketStatus);

    addWork({
      title,
      authorId,
      hash,
      marketStatus: finalMarketStatus,
    });

    router.push("/manage");
  }

  /* ================= UI ================= */

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {/* ===== HEADER ===== */}
        <div className={styles.header}>
          <h1 className={styles.title}>
            Đăng ký tác phẩm
          </h1>
          <p className={styles.subtitle}>
            Đăng ký bảo vệ bản quyền tác phẩm số
          </p>
        </div>

        <div
          className={`${styles.form} ${
            styles[`glowStep${step}`]
          }`}
        >
          {/* ===== PROGRESS ===== */}
          <div className={styles.progress}>
            <div
              className={styles.progressBar}
              style={{
                width: `${step * 33.33}%`,
              }}
            />
          </div>

          <div className={styles.stepContainer}>
            {/* ================= STEP 1 ================= */}
            <section
              className={`${styles.stepPane} ${
                step === 1
                  ? styles.active
                  : styles.hidden
              }`}
            >
              <div className={styles.grid}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Tên tác phẩm
                  </label>
                  <input
                    value={title}
                    onChange={(e) =>
                      setTitle(e.target.value)
                    }
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>
                    Thể loại
                  </label>
                  <input
                    value={genre}
                    onChange={(e) =>
                      setGenre(e.target.value)
                    }
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>
                    Ngôn ngữ
                  </label>
                  <select
                    className={styles.select}
                    value={language}
                    onChange={(e) =>
                      setLanguage(e.target.value)
                    }
                  >
                    <option value="vi">
                      Tiếng Việt
                    </option>
                    <option value="en">
                      English
                    </option>
                    <option value="jp">
                      日本語
                    </option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>
                    Ngày sáng tác
                  </label>
                  <input
                    type="date"
                    value={completedAt}
                    onChange={(e) =>
                      setCompletedAt(
                        e.target.value
                      )
                    }
                  />
                </div>
              </div>

              <div className={styles.uploadBox}>
                <span>
                  {fileName ||
                    "Chưa chọn file"}
                </span>

                <label className={styles.button}>
                  Chọn file tác phẩm
                  <input
                    type="file"
                    accept="audio/*,video/*"
                    onChange={(e) => {
                      const file =
                        e.target.files?.[0];
                      if (!file) return;
                      setFileName(file.name);
                      generateHash();
                      readDuration(file);
                    }}
                  />
                </label>

                {duration && (
                  <div
                    className={styles.duration}
                  >
                    ⏱{" "}
                    {Math.floor(duration / 60)}
                    :
                    {Math.floor(duration % 60)
                      .toString()
                      .padStart(2, "0")}
                  </div>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  Trạng thái thị trường
                </label>

                <div
                  className={styles.radioGroup}
                >
                  <label
                    className={styles.radio}
                  >
                    <input
                      type="radio"
                      checked={
                        marketStatus ===
                        "private"
                      }
                      onChange={() =>
                        setMarketStatus(
                          "private"
                        )
                      }
                    />
                    Chưa công bố
                  </label>

                  <label
                    className={styles.radio}
                  >
                    <input
                      type="radio"
                      checked={
                        marketStatus ===
                        "public"
                      }
                      onChange={() =>
                        setMarketStatus(
                          "public"
                        )
                      }
                    />
                    Đã có trên thị trường
                  </label>

                  <label
                    className={styles.radio}
                  >
                    <input
                      type="radio"
                      checked={
                        marketStatus ===
                        "pending"
                      }
                      onChange={() =>
                        setMarketStatus(
                          "pending"
                        )
                      }
                    />
                    Chuẩn bị phát hành
                  </label>
                </div>
              </div>

              <div className={styles.actions}>
                <div />
                <button
                  className={styles.submit}
                  disabled={!step1Valid}
                  onClick={() => setStep(2)}
                >
                  Tiếp tục
                </button>
              </div>
            </section>

            {/* ================= STEP 2 ================= */}
            <section
              className={`${styles.stepPane} ${
                step === 2
                  ? styles.active
                  : styles.hidden
              }`}
            >
              <div className={styles.section}>
                <h3
                  className={
                    styles.sectionTitle
                  }
                >
                  Người đăng ký
                </h3>

                <div
                  className={styles.registrant}
                >
                  <div
                    className={styles.avatar}
                  >
                    {authorId[0].toUpperCase()}
                  </div>

                  <div
                    className={
                      styles.registrantInfo
                    }
                  >
                    <strong>
                      {user.email}
                    </strong>
                    <span>ID: {authorId}</span>
                    <span
                      className={styles.badge}
                    >
                      Verified Author
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.actions}>
                <button
                  className={styles.back}
                  onClick={() => setStep(1)}
                >
                  Quay lại
                </button>
                <button
                  className={styles.submit}
                  onClick={() => setStep(3)}
                >
                  Tiếp tục
                </button>
              </div>
            </section>

            {/* ================= STEP 3 ================= */}
            <section
              className={`${styles.stepPane} ${
                step === 3
                  ? styles.active
                  : styles.hidden
              }`}
            >
              <div className={styles.confirmBox}>
                <div>
                  <strong>IPFS CID</strong>
                  <div>
                    {ipfsCid || "Chưa upload"}
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <strong>
                    Transaction Hash
                  </strong>
                  <div>
                    {txHash ||
                      "Chưa ghi on-chain"}
                  </div>
                </div>
              </div>

              <div className={styles.actions}>
                <button
                  className={styles.back}
                  onClick={() => setStep(2)}
                >
                  Quay lại
                </button>

                {!ipfsCid ? (
                  <button
                    className={styles.submit}
                    onClick={uploadIPFS}
                  >
                    Upload IPFS
                  </button>
                ) : !txHash ? (
                  <button
                    className={styles.submit}
                    onClick={registerOnChain}
                  >
                    Ghi on-chain
                  </button>
                ) : (
                  <button
                    className={styles.submit}
                    onClick={finish}
                  >
                    Hoàn tất
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
