"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getAuthorById } from "@/lib/authorStore";
import { addWork, MarketStatus } from "@/lib/workStore";

/* ===== SHA256 ===== */
async function sha256(file: File) {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function RegisterWorkPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);

  /* ===== WORK INFO ===== */
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("");
  const [duration, setDuration] = useState("");
  const [completedDate, setCompletedDate] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // ✅ FIX: dùng đúng MarketStatus
  const [market, setMarket] = useState<MarketStatus>("private");

  /* ===== AUTHOR ===== */
  const [author, setAuthor] = useState<any>(null);
  const [agree, setAgree] = useState(false);

  /* ===== AUTH CHECK ===== */
  useEffect(() => {
    if (!loading) {
      if (!user || user.role !== "author") {
        router.push("/login");
        return;
      }

      const a = getAuthorById(user.id);
      if (!a || a.status !== "approved") {
        alert("Tác giả chưa được duyệt");
        router.push("/");
        return;
      }

      setAuthor(a);
    }
  }, [user, loading, router]);

  /* ===== SUBMIT ===== */
  const submit = async () => {
    if (!file) return alert("Vui lòng tải file gốc");
    if (!agree) return alert("Bạn chưa xác nhận thông tin");

    const fileHash = await sha256(file);

    addWork({
      title,
      authorId: user!.id,
      genre,
      language,
      completedDate,
      duration: Number(duration),
      fileHash,
      marketStatus: market, // ✅ đúng type
    });

    alert("Đăng ký tác phẩm thành công. Chờ admin duyệt.");
    router.push("/manage");
  };

  if (!author) return null;

  return (
    <div className={styles.page}>
      <div className={styles.outer}>
        <div className={styles.panel}>
          <h1 className={styles.title}>Đăng ký bảo vệ tác phẩm</h1>

          {/* ===== STEP 1 ===== */}
          {step === 1 && (
            <>
              <h2 className={styles.section}>Thông tin tác phẩm</h2>

              <div className={styles.formGrid}>
                <input
                  className={styles.field}
                  placeholder="Tên tác phẩm"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />

                <input
                  className={styles.field}
                  placeholder="Thể loại"
                  value={genre}
                  onChange={e => setGenre(e.target.value)}
                />

                <input
                  className={styles.field}
                  placeholder="Ngôn ngữ"
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                />

                <input
                  className={styles.field}
                  placeholder="Thời lượng (giây)"
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                />

                <input
                  className={styles.field}
                  type="date"
                  value={completedDate}
                  onChange={e => setCompletedDate(e.target.value)}
                />

                <input
                  className={`${styles.field} ${styles.full}`}
                  type="file"
                  accept="audio/*"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
              </div>

              {/* ===== MARKET STATUS ===== */}
              <div className={styles.radioRow}>
                <label>
                  <input
                    type="radio"
                    checked={market === "public"}
                    onChange={() => setMarket("public")}
                  />
                  Đã có trên thị trường
                </label>

                <label>
                  <input
                    type="radio"
                    checked={market === "private"}
                    onChange={() => setMarket("private")}
                  />
                  Chưa có trên thị trường
                </label>
              </div>

              <div className={styles.actionsCenter}>
                <button
                  className={styles.primary}
                  onClick={() => setStep(2)}
                >
                  Tiếp theo
                </button>
              </div>
            </>
          )}

          {/* ===== STEP 2 ===== */}
          {step === 2 && (
            <>
              <h2 className={styles.section}>Thông tin tác giả</h2>

              <div className={styles.formGrid}>
                <input className={styles.field} value={author.name} disabled />
                <input className={styles.field} value={author.birthDate} disabled />
                <input className={styles.field} value={author.nationality} disabled />
                <input className={styles.field} value={author.stageName || ""} disabled />
                <input
                  className={styles.field}
                  value={author.contact || ""}
                  onChange={e =>
                    setAuthor({ ...author, contact: e.target.value })
                  }
                  placeholder="Email / Số điện thoại"
                />
                <input
                  className={styles.field}
                  value={author.position || ""}
                  placeholder="Vai trò (Ca sĩ, nhà sáng tác...)"
                  onChange={e =>
                    setAuthor({ ...author, position: e.target.value })
                  }
                />
                <input
                  className={`${styles.field} ${styles.full}`}
                  value={author.address || ""}
                  placeholder="Mã ví"
                  disabled
                />
              </div>

              {/* ===== COMMIT ===== */}
              <div className={styles.checkboxWrap}>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={e => setAgree(e.target.checked)}
                    className={styles.hiddenCheckbox}
                  />
                  <span className={styles.customCheckbox} />
                  <span className={styles.checkboxText}>
                    Tôi xin cam kết mọi dữ liệu khai báo là đúng sự thật
                  </span>
                </label>
              </div>

              <div className={styles.actionsBetween}>
                <button
                  className={styles.outline}
                  onClick={() => setStep(1)}
                >
                  Quay lại
                </button>

                <button
                  className={styles.primary}
                  disabled={!agree}
                  onClick={submit}
                >
                  Hoàn tất đăng ký
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
