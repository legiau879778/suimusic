"use client";

import React from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";

export default function GoogleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    // để dev dễ thấy lỗi env thay vì crash mơ hồ
    console.error("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local");
    return <>{children}</>;
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      {children}
    </GoogleOAuthProvider>
  );
}
