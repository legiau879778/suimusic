"use client";

import { useAuth } from "@/context/AuthContext";
import { useModal } from "@/context/ModalContext";
import { useState } from "react";

export default function LoginModal() {
  const { login } = useAuth();
  const { closeLogin } = useModal();
  const [email, setEmail] = useState("");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ background: "#020617", padding: 30 }}>
        <h3>Đăng nhập</h3>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <br />
        <button
          onClick={() => {
            login(email);
            closeLogin();
          }}
        >
          Login
        </button>
      </div>
    </div>
  );
}
