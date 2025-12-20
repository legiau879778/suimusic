"use client";

import { useState } from "react";
import Link from "next/link";
import { getAuthors, Author } from "@/lib/authorStore";
import styles from "@/styles/search.module.css";

export default function SearchAuthorPage() {
  const authors = getAuthors();

  const [name, setName] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [nation, setNation] = useState("");

  const filtered = authors.filter((a) => {
    if (
      name &&
      !a.name.toLowerCase().includes(name.toLowerCase())
    )
      return false;

    if (
      authorId &&
      !a.id.toLowerCase().includes(authorId.toLowerCase())
    )
      return false;

    if (
      nation &&
      !a.nationality
        .toLowerCase()
        .includes(nation.toLowerCase())
    )
      return false;

    return true;
  });

  return (
    <div className={styles.page}>
      <h1>Tra cứu tác giả</h1>
      <p className={styles.sub}>
        Tra cứu thông tin tác giả và tác phẩm đã đăng ký
      </p>

      {/* FILTER BAR */}
      <div className={styles.filters}>
        <input
          placeholder="Tên tác giả"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          placeholder="Mã tác giả"
          value={authorId}
          onChange={(e) => setAuthorId(e.target.value)}
        />

        <input
          placeholder="Quốc tịch"
          value={nation}
          onChange={(e) => setNation(e.target.value)}
        />
      </div>

      {/* RESULT */}
      <div className={styles.grid}>
        {filtered.map((a) => (
          <Link
            key={a.id}
            href={`/author/${a.id}`}
            className={styles.card}
          >
            <div className={styles.avatar}>
              {a.name.charAt(0)}
            </div>
            <h3>{a.name}</h3>
            <p>Mã: {a.id}</p>
            <p>Quốc tịch: {a.nationality}</p>
          </Link>
        ))}

        {filtered.length === 0 && (
          <p className={styles.empty}>
            Không tìm thấy tác giả
          </p>
        )}
      </div>
    </div>
  );
}
