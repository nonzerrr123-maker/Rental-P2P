import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "P2P Marketplace",
  description: "พื้นที่ซื้อขายแลกเปลี่ยนระหว่างผู้ใช้งาน",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
