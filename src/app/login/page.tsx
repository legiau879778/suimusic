"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <div style={{ padding: 80, textAlign: "center" }}>
      <h2>Đăng nhập</h2>

      <button
        onClick={() => signIn("google")}
        style={{ marginTop: 20 }}
      >
        Đăng nhập với Google
      </button>
    </div>
  );
}
