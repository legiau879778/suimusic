import "./globals.css";
import type { Metadata } from "next";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "@fortawesome/fontawesome-free/css/all.min.css";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Providers from "@/components/Providers"; // 👈 client wrapper

export const metadata: Metadata = {
  title: "Chainstorm",
  description: "Music Copyright on Blockchain",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <GoogleOAuthProvider
          clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}
        >
          <Providers>
            <Header />
            {children}
            <Footer />
          </Providers>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
