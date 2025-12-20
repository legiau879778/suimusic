"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/form.module.css";
import { addAuthor } from "@/lib/authorStore";

export default function RegisterAuthorPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [stageName, setStageName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nationality, setNationality] = useState("");

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Đăng ký tác giả</h1>

      <input className={styles.input} placeholder="Tên thật"
        value={name} onChange={e => setName(e.target.value)} />

      <input className={styles.input} placeholder="Nghệ danh"
        value={stageName} onChange={e => setStageName(e.target.value)} />

      <input className={styles.input} type="date"
        value={birthDate} onChange={e => setBirthDate(e.target.value)} />

      <input className={styles.input} placeholder="Quốc tịch"
        value={nationality} onChange={e => setNationality(e.target.value)} />

      <button className={styles.primary}
        onClick={() => {
          addAuthor({ name, stageName, birthDate, nationality });
          router.push("/login");
        }}>
        Gửi đăng ký
      </button>
    </div>
  );
}
