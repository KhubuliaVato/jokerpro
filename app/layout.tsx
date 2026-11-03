import type { Metadata, Viewport } from "next";
import { Noto_Sans_Georgian } from "next/font/google";
import Script from "next/script";
import { preconnect } from "react-dom";
import { BanBanner } from "@/components/BanBanner";
import { GiftPopup } from "@/components/GiftPopup";
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
  themeColor: "#2a0a12",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // open the connection to the database early: it is far away, so each handshake costs a noticeable moment
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) preconnect(process.env.NEXT_PUBLIC_SUPABASE_URL, { crossOrigin: "anonymous" });
  return (
    <html lang="ka" className={notoGeorgian.variable} suppressHydrationWarning>
      <body>
        {/* paint the saved background colour before the first frame */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`}
        </Script>
        <LangProvider>
          <AuthProvider>
            <BanBanner />
            <GiftPopup />
            <PageFade>{children}</PageFade>
          </AuthProvider>
        </LangProvider>
      </body>
    </html>
  );
}
