"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getAuthors, Author } from "@/lib/authorStore";

export default function SearchPage() {
  const [keyword, setKeyword] = useState("");
  const [authors, setAuthors] = useState<Author[]>([]);

  useEffect(() => {
    // ✅ CHỈ LẤY TÁC GIẢ ĐÃ DUYỆT
    const approvedAuthors = getAuthors().filter(
      a => a.status === "approved"
    );
    setAuthors(approvedAuthors);
  }, []);

  const filtered = useMemo(() => {
    const k = keyword.toLowerCase().trim();

    if (!k) return authors;

    return authors.filter(a =>
      (a.stageName && a.stageName.toLowerCase().includes(k)) ||
      (a.name && a.name.toLowerCase().includes(k)) ||
      (a.id && a.id.toLowerCase().includes(k)) ||
      (a.nationality && a.nationality.toLowerCase().includes(k))
    );
  }, [keyword, authors]);

  return (
    <div style={{ padding: 40 }}>
      <h1>Tra cứu tác giả</h1>

      <input
        placeholder="Tên tác giả / Mã tác giả / Quốc tịch"
        value={keyword}
        onChange={e => setKeyword(e.target.value)}
        style={{ width: 360, marginBottom: 24 }}
      />

      {filtered.length === 0 && (
        <p>Không tìm thấy tác giả phù hợp</p>
      )}

      <div style={{ display: "grid", gap: 16 }}>
        {filtered.map(a => (
          <Link
            key={a.id}
            href={`/author/${a.id}`}
            style={{
              padding: 16,
              border: "1px solid #334155",
              borderRadius: 12,
              display: "block",
            }}
          >
            <b>{a.stageName || a.name}</b>
            <div>Mã: {a.id}</div>
            <div>Quốc tịch: {a.nationality}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
