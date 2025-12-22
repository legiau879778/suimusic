"use client";

import { useState } from "react";
import styles from "@/app/register-work/registWork.module.css";
import { useAuth } from "@/context/AuthContext";
import { addWork } from "@/lib/workStore";

export default function RegisterWorkPage() {
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("");
  const [completedDate, setCompletedDate] = useState("");
  const [duration, setDuration] = useState<number | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<string>("");

  if (!user) {
    return (
      <main className={styles.page}>
        <div className={styles.locked}>
          <h2>Bạn cần đăng nhập</h2>
          <p>Đăng nhập để đăng ký bảo vệ tác phẩm.</p>
        </div>
      </main>
    );
  }

  async function generateHash(f: File) {
    // MOCK hash – thay bằng lib/hash.ts khi gắn thật
    const fakeHash =
      "0x" +
      Math.random().toString(16).slice(2) +
      Math.random().toString(16).slice(2);
    setHash(fakeHash);
  }

  function submit() {
    if (!title || !file || !hash) return;

    addWork({
      title,
      authorId: user.id,
      genre,
      language,
      completedDate,
      marketStatus: "private",
      duration: typeof duration === "number" ? duration : 0,
      fileHash: hash,
    });

    alert("Đăng ký tác phẩm thành công!");
    setTitle("");
    setGenre("");
    setLanguage("");
    setCompletedDate("");
    setDuration("");
    setFile(null);
    setHash("");
  }

  return (
    <main className={styles.page}>
      {/* HEADER */}
      <section className={styles.header}>
        <h1 className={styles.title}>Đăng ký bảo vệ tác phẩm</h1>
        <p className={styles.subtitle}>
          Nhập thông tin và tải file gốc để tạo dấu vân tay bản quyền.
        </p>
      </section>

      {/* FORM */}
      <section className={styles.form}>
        <div className={styles.field}>
          <label>Tên tác phẩm</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Digital Artwork #A19"
          />
        </div>

        <div className={styles.grid}>
          <div className={styles.field}>
            <label>Thể loại</label>
            <input
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder="Artwork / Music / Video…"
            />
          </div>

          <div className={styles.field}>
            <label>Ngôn ngữ</label>
            <input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="VN / EN / JP…"
            />
          </div>

          <div className={styles.field}>
            <label>Ngày hoàn thành</label>
            <input
              type="date"
              value={completedDate}
              onChange={(e) => setCompletedDate(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label>Thời lượng (phút)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) =>
                setDuration(e.target.value ? Number(e.target.value) : "")
              }
            />
          </div>
        </div>

        <div className={styles.field}>
          <label>File gốc</label>
          <input
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                generateHash(f);
              }
            }}
          />
        </div>

        {hash && (
          <div className={styles.hashBox}>
            <span>Hash SHA-256</span>
            <code>{hash}</code>
          </div>
        )}

        <div className={styles.actions}>
          <button
            className={styles.submit}
            onClick={submit}
            disabled={!title || !file || !hash}
          >
            Gửi đăng ký
          </button>
        </div>
      </section>
    </main>
  );
}
