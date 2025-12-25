// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

import Providers from "@/components/Providers";
import GoogleProvider from "@/components/GoogleProvider";

export const metadata: Metadata = {
  title: "SUIMUSIC",
  description: "Music Copyright on Blockchain",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body suppressHydrationWarning>
        <GoogleProvider>
          <Providers>{children}</Providers>
        </GoogleProvider>
      </body>
    </html>
  );
}
