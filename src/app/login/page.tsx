"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getAuthors } from "@/lib/authorStore";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const router = useRouter();
  const { loginAsAdmin, loginAsAuthor } = useAuth();

  const submit = () => {
    if (!username.trim()) {
      alert("Nhập tên đăng nhập");
      return;
    }

    // ADMIN
    if (username === "admin") {
      loginAsAdmin();
      router.push("/admin");
      return;
    }

    // AUTHOR
    const uname = username.toLowerCase();
    const author = getAuthors().find(
      a =>
        (a.stageName && a.stageName.toLowerCase() === uname) ||
        (a.name && a.name.toLowerCase() === uname)
    );

    if (!author) {
      alert("Không tìm thấy tác giả");
      return;
    }

    loginAsAuthor(author.id, author.stageName || author.name);

    if (author.status === "approved") {
      router.push("/manage");
    } else {
      alert("Tác giả đang chờ duyệt");
      router.push("/");
    }
  };

  return (
    <div className="auth-page">
      <h1>Đăng nhập</h1>

      <input
        placeholder="Admin hoặc nghệ danh tác giả"
        value={username}
        onChange={e => setUsername(e.target.value)}
      />

      <button onClick={submit}>Đăng nhập</button>

      <p style={{ marginTop: 16 }}>
        Chưa có tài khoản?{" "}
        <a href="/register-author">Đăng ký tác giả</a>
      </p>
    </div>
  );
}
