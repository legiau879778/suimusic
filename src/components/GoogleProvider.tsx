"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";

export default function GoogleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // ✅ LUÔN bọc Provider để tránh crash build / prerender
  // Nếu thiếu env → dùng dummy id (login sẽ không hoạt động, nhưng app/build OK)
  return (
    <GoogleOAuthProvider clientId={clientId || "DUMMY_CLIENT_ID"}>
      {children}
    </GoogleOAuthProvider>
  );
}
