"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addAuthor } from "@/lib/authorStore";

export default function RegisterAuthorPage() {
  const [name, setName] = useState("");
  const [stageName, setStageName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nationality, setNationality] = useState("");
  const router = useRouter();

  const submit = () => {
    if (!name || !birthDate || !nationality) {
      alert("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    addAuthor({
      name,
      stageName,
      birthDate,
      nationality,
    });

    alert("Đăng ký thành công. Vui lòng chờ admin duyệt.");
    router.push("/login");
  };

  return (
    <div className="auth-page">
      <h1>Đăng ký tác giả</h1>

      <input
        placeholder="Tên thật"
        value={name}
        onChange={e => setName(e.target.value)}
      />

      <input
        placeholder="Nghệ danh (không bắt buộc)"
        value={stageName}
        onChange={e => setStageName(e.target.value)}
      />

      <input
        type="date"
        value={birthDate}
        onChange={e => setBirthDate(e.target.value)}
      />

      <input
        placeholder="Quốc tịch"
        value={nationality}
        onChange={e => setNationality(e.target.value)}
      />

      <button onClick={submit}>Đăng ký</button>
    </div>
  );
}
