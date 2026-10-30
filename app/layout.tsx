import type { Metadata, Viewport } from "next";
import { Noto_Sans_Georgian } from "next/font/google";
import { PageFade } from "@/components/PageFade";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { LangProvider } from "@/lib/i18n";
import "./globals.css";

const notoGeorgian = Noto_Sans_Georgian({
  variable: "--font-noto-georgian",
  subsets: ["georgian", "latin"],
});

export const metadata: Metadata = {
  title: "ProJoker",
  description: "ქართული კარტის თამაშები",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a2418",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ka" className={notoGeorgian.variable}>
      <body>
        <LangProvider>
          <AuthProvider>
            <PageFade>{children}</PageFade>
          </AuthProvider>
        </LangProvider>
      </body>
    </html>
  );
}
