import type { Metadata, Viewport } from "next";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Borow Borow — อยากใช้ ไม่ต้องซื้อ",
    template: "%s | Borow Borow",
  },
  description: "แพลตฟอร์มยืมและให้ยืมของระหว่างคนใกล้ตัว ค้นหา จอง ชำระ แชต รับของ และคืนของได้ในที่เดียว",
  applicationName: "Borow Borow",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#faf9f6",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>
        {children}
        <MobileBottomNav />
      </body>
    </html>
  );
}
