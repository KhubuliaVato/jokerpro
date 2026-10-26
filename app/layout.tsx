import type { Metadata, Viewport } from "next";
import { Noto_Sans_Georgian } from "next/font/google";
import "./globals.css";

const notoGeorgian = Noto_Sans_Georgian({
  variable: "--font-noto-georgian",
  subsets: ["georgian", "latin"],
});

export const metadata: Metadata = {
  title: "ჯოკერი",
  description: "ქართული კარტის თამაში ჯოკერი ბოტებთან",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a2418",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ka" className={notoGeorgian.variable}>
      <body>{children}</body>
    </html>
  );
}
