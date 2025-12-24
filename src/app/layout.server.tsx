import "./globals.css";
import type { Metadata } from "next";
import "@fortawesome/fontawesome-free/css/all.min.css";

import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "Chainstorm",
  description: "Music Copyright on Blockchain",
};

export default function RootLayoutServer({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
