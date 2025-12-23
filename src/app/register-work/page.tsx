"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { addWork } from "@/lib/workStore";
import styles from "./registWork.module.css";

/* ================= TYPES ================= */

type Step = 1 | 2 | 3;
type SellType = "none" | "sell" | "license";
type Currency = "SUI" | "USDT";

/* ================= COMPONENT ================= */

export default function RegisterWorkPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);

  /* ===== WORK INFO ===== */
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("vi");
  const [completedAt, setCompletedAt] = useState("");

  /* ===== AUTHOR ===== */
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [authorCode, setAuthorCode] = useState("");
  const [authorPhone, setAuthorPhone] = useState("");

  /* ===== FILE ===== */
  const [fileName, setFileName] = useState("");
  const [hash, setHash] = useState("");
  const [duration, setDuration] = useState<number | null>(null);

  /* ===== COMMERCIAL ===== */
  const [sellType, setSellType] =
    useState<SellType>("none");
  const [price, setPrice] =
    useState<number | "">("");
  const [currency, setCurrency] =
    useState<Currency>("SUI");
  const [royalty, setRoyalty] =
    useState<number | "">("");

  /* ===== STEP 3 MOCK ===== */
  const [ipfsCid, setIpfsCid] =
    useState<string | null>(null);
  const [txHash, setTxHash] =
    useState<string | null>(null);

  /* ================= AUTH ================= */

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }

    setAuthorName(user.name || "");
    setAuthorEmail(user.email || "");

    const year = new Date().getFullYear();
    setAuthorCode(
      `AUTH-${year}-${user.id
        .slice(0, 6)
        .toUpperCase()}`
    );

    setAuthorPhone((user as any)?.phone || "");
  }, [user, router]);

  if (!user) return null;
  const authorId = user.id;

  /* ================= HELPERS ================= */

  function generateHash() {
    setHash(
      crypto.randomUUID().replace(/-/g, "")
    );
  }

  function readDuration(file: File) {
    const url = URL.createObjectURL(file);
    const media = document.createElement(
      file.type.startsWith("audio")
        ? "audio"
        : "video"
    );

    media.src = url;
    media.onloadedmetadata = () => {
      setDuration(media.duration);
      URL.revokeObjectURL(url);
    };
  }

  function formatDuration(sec: number) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);

    return h > 0
      ? `${h}:${m.toString().padStart(2, "0")}:${s
          .toString()
          .padStart(2, "0")}`
      : `${m}:${s.toString().padStart(2, "0")}`;
  }

  function copyAuthorCode() {
    navigator.clipboard.writeText(authorCode);
    alert("Đã copy mã tác giả");
  }

  const step1Valid =
    !!(
      title &&
      genre &&
      completedAt &&
      fileName &&
      hash &&
      authorName &&
      authorEmail &&
      (
        sellType === "none" ||
        (
          price &&
          Number(price) > 0 &&
          (
            sellType !== "license" ||
            (
              royalty !== "" &&
              Number(royalty) >= 0 &&
              Number(royalty) <= 30
            )
          )
        )
      )
    );

  /* ================= MOCK ACTIONS ================= */

  async function uploadIPFS() {
    await new Promise(r => setTimeout(r, 1000));
    setIpfsCid("ipfs://mockCID");
  }

  async function registerOnChain() {
    await new Promise(r => setTimeout(r, 1000));
    setTxHash("0xMOCKTXHASH");
  }

  function finish() {
    addWork({
      title,
      authorId,
      hash,
      // duration,
    });
    router.push("/manage");
  }

  /* ================= UI ================= */

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            Đăng ký tác phẩm
          </h1>
          <p className={styles.subtitle}>
            Bảo vệ & khai thác thương mại
          </p>
        </div>

        <div
          className={`${styles.form} ${
            styles[`glowStep${step}`]
          }`}
        >
          {/* PROGRESS */}
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
                step === 1 ? styles.active : ""
              }`}
            >
              {/* WORK INFO */}
              <div className={styles.subCard}>
                <div className={styles.sectionTitle}>
                  Thông tin tác phẩm
                </div>

                <div className={styles.grid}>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      Tên tác phẩm
                    </label>
                    <input
                      value={title}
                      onChange={e =>
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
                      onChange={e =>
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
                      onChange={e =>
                        setLanguage(e.target.value)
                      }
                    >
                      <option value="vi">
                        Tiếng Việt
                      </option>
                      <option value="en">
                        English
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
                      onChange={e =>
                        setCompletedAt(
                          e.target.value
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              {/* AUTHOR */}
              <div className={styles.subCard}>
                <div className={styles.sectionTitle}>
                  Tác giả
                </div>

                <div className={styles.grid}>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      Mã tác giả
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input value={authorCode} disabled />
                      <button
                        type="button"
                        className={styles.copyBtn}
                        onClick={copyAuthorCode}
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>
                      Số điện thoại
                    </label>
                    <input
                      value={
                        authorPhone || "Chưa cập nhật"
                      }
                      disabled
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>
                      Tên tác giả
                    </label>
                    <input
                      value={authorName}
                      onChange={e =>
                        setAuthorName(
                          e.target.value
                        )
                      }
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>
                      Email
                    </label>
                    <input
                      value={authorEmail}
                      onChange={e =>
                        setAuthorEmail(
                          e.target.value
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              {/* FILE */}
              <div className={styles.subCard}>
                <div className={styles.uploadBox}>
                  <div>
                    {fileName || "Chưa chọn file"}
                  </div>

                  <label className={styles.button}>
                    Chọn file
                    <input
                      type="file"
                      accept="audio/*,video/*"
                      onChange={e => {
                        const f =
                          e.target.files?.[0];
                        if (!f) return;
                        setFileName(f.name);
                        generateHash();
                        readDuration(f);
                      }}
                    />
                  </label>

                  {duration && (
                    <div className={styles.duration}>
                      ⏱ Thời lượng:{" "}
                      {formatDuration(duration)}
                    </div>
                  )}
                </div>
              </div>

              {/* COMMERCIAL */}
              <div className={styles.subCard}>
                <div className={styles.sectionTitle}>
                  Khai thác thương mại
                </div>

                <div className={styles.radioGroup}>
                  {[
                    ["none", "Không bán"],
                    ["sell", "Bán đứt"],
                    ["license", "Bán license / thuê"],
                  ].map(([v, label]) => (
                    <label
                      key={v}
                      className={styles.radio}
                    >
                      <input
                        type="radio"
                        checked={sellType === v}
                        onChange={() => {
                          setSellType(
                            v as SellType
                          );
                          if (v === "none") {
                            setPrice("");
                            setRoyalty("");
                          }
                        }}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                {sellType !== "none" && (
                  <div
                    className={`${styles.commercialBox} ${
                      sellType === "license"
                        ? styles.licenseActive
                        : ""
                    }`}
                  >
                    <div className={styles.commercialGrid}>
                      <div className={styles.field}>
                        <label className={styles.label}>
                          Giá
                        </label>
                        <input
                          type="number"
                          value={price}
                          onChange={e =>
                            setPrice(
                              e.target.value
                                ? Number(e.target.value)
                                : ""
                            )
                          }
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>
                          Đơn vị
                        </label>
                        <select
                          className={styles.select}
                          value={currency}
                          onChange={e =>
                            setCurrency(
                              e.target
                                .value as Currency
                            )
                          }
                        >
                          <option value="SUI">SUI</option>
                          <option value="USDT">USDT</option>
                        </select>
                      </div>
                    </div>

                    {sellType === "license" && (
                      <div className={styles.royaltyBox}>
                        <div className={styles.royaltyHeader}>
                          <label className={styles.label}>
                            Royalty (%)
                          </label>
                          <div className={styles.royaltyInfo}>
                            ?
                          </div>
                        </div>

                        <input
                          type="number"
                          value={royalty}
                          onChange={e =>
                            setRoyalty(
                              e.target.value
                                ? Number(e.target.value)
                                : ""
                            )
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
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
                step === 2 ? styles.active : ""
              }`}
            >
              <div className={styles.reviewCard}>
                <h3>📄 Xác nhận thông tin</h3>

                <div className={styles.reviewRow}>
                  <span>Tác phẩm</span>
                  <strong>{title}</strong>
                </div>

                <div className={styles.reviewRow}>
                  <span>Tác giả</span>
                  <strong>{authorName}</strong>
                </div>

                <div className={styles.reviewRow}>
                  <span>Mã tác giả</span>
                  <strong>{authorCode}</strong>
                </div>

                <div className={styles.reviewRow}>
                  <span>Email</span>
                  <strong>{authorEmail}</strong>
                </div>

                <div className={styles.reviewRow}>
                  <span>Số điện thoại</span>
                  <strong>
                    {authorPhone || "Chưa cập nhật"}
                  </strong>
                </div>

                {duration && (
                  <div className={styles.reviewRow}>
                    <span>Thời lượng</span>
                    <strong>
                      {formatDuration(duration)}
                    </strong>
                  </div>
                )}

                <div className={styles.reviewRow}>
                  <span>Khai thác</span>
                  <strong>
                    {sellType === "none"
                      ? "Không bán"
                      : sellType === "sell"
                      ? "Bán đứt"
                      : "License / thuê"}
                  </strong>
                </div>

                {sellType !== "none" && (
                  <div className={styles.reviewRow}>
                    <span>Giá</span>
                    <strong>
                      {price} {currency}
                    </strong>
                  </div>
                )}

                {sellType === "license" && (
                  <div className={styles.reviewRow}>
                    <span>Royalty</span>
                    <strong>{royalty}%</strong>
                  </div>
                )}
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
                step === 3 ? styles.active : ""
              }`}
            >
              <div className={styles.reviewCard}>
                <div className={styles.reviewRow}>
                  <span>IPFS</span>
                  <strong>
                    {ipfsCid || "Chưa upload"}
                  </strong>
                </div>

                <div className={styles.reviewRow}>
                  <span>Transaction</span>
                  <strong>
                    {txHash || "Chưa ghi"}
                  </strong>
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
