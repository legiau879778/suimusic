"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getAuthorById } from "@/lib/authorStore";
import { getWorks, countWorksByAuthor, Work } from "@/lib/workStore";
import styles from "@/app/author/[id]/author.module.css";

export default function AuthorPage() {
  const { id } = useParams<{ id: string }>();
  const author = getAuthorById(id);

  const [works, setWorks] = useState<Work[]>([]);
  const [filterTitle, setFilterTitle] = useState("");
  const [filterHash, setFilterHash] = useState("");

  useEffect(() => {
    setWorks(getWorks().filter(w => w.authorId === id));
  }, [id]);

  const filtered = useMemo(() => {
    return works.filter(w =>
      w.title.toLowerCase().includes(filterTitle.toLowerCase()) &&
      (w.hash || "")
        .toLowerCase()
        .includes(filterHash.toLowerCase())
    );
  }, [works, filterTitle, filterHash]);

  if (!author) {
    return <p style={{ padding: 40 }}>Không tìm thấy tác giả</p>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.avatar}>
          {(author.stageName || author.name || "?")
            .charAt(0)
            .toUpperCase()}
        </div>

        <div>
          <h1 className={styles.name}>{author.stageName}</h1>
          <p className={styles.meta}>
            Tên thật: {author.name}<br />
            Ngày sinh: {author.birthDate}<br />
            Quốc tịch: {author.nationality}<br />
            {countWorksByAuthor(author.id)} tác phẩm
          </p>
        </div>
      </div>

      <div className={styles.filters}>
        <input
          className={styles.input}
          placeholder="Lọc theo tên tác phẩm"
          value={filterTitle}
          onChange={e => setFilterTitle(e.target.value)}
        />

        <input
          className={styles.input}
          placeholder="Lọc theo SHA-256"
          value={filterHash}
          onChange={e => setFilterHash(e.target.value)}
        />
      </div>

      {filtered.length === 0 && (
        <p className={styles.empty}>Không có tác phẩm phù hợp</p>
      )}

      <div className={styles.grid}>
        {filtered.map(w => (
          <div key={w.id} className={styles.card}>
            <h3>{w.title}</h3>
            <p className={styles.status}>
              Trạng thái: {w.status}
            </p>

            {w.hash && (
              <p className={styles.hash}>{w.hash}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
