// UPDATED: layout spacing + structure

import "@/app/globals.css";
import Header from "@/components/Header";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <Header />
        <main>
          <div className="container">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
