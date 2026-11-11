import type { Metadata, Viewport } from "next";
import { Noto_Sans_Georgian } from "next/font/google";
import Script from "next/script";
import { preconnect } from "react-dom";
import { BanBanner } from "@/components/BanBanner";
import { Analytics } from "@/components/Analytics";
import { ErrorReporter } from "@/components/ErrorReporter";
import { FriendsDock } from "@/components/FriendsDock";
import { GiftPopup } from "@/components/GiftPopup";
import { InviteWelcome } from "@/components/InviteWelcome";
import { NicknamePrompt } from "@/components/NicknamePrompt";
import { PageFade } from "@/components/PageFade";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { LangProvider } from "@/lib/i18n";
import "./globals.css";

const notoGeorgian = Noto_Sans_Georgian({
  variable: "--font-noto-georgian",
  subsets: ["georgian", "latin"],
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://projoker.netlify.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "ProJoker: ჯოკერი, ბურა და პოკერი ონლაინ", template: "%s | ProJoker" },
  description: "ითამაშე ჯოკერი, ბურა და პოკერი ონლაინ ქართულად: ბოტებთან უფასოდ, მეგობრებთან კოდით ან რეიტინგიან მაგიდაზე. წოდებები, ლიდერბორდი და მაღაზია.",
  openGraph: { siteName: "ProJoker", type: "website", locale: "ka_GE" },
  twitter: { card: "summary_large_image" },
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
          {`try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t;if(localStorage.getItem("motion")==="off")document.documentElement.dataset.motion="off"}catch(e){}`}
        </Script>
        <LangProvider>
          <AuthProvider>
            <ErrorReporter />
            <Analytics />
            <BanBanner />
            <InviteWelcome />
            <GiftPopup />
            <NicknamePrompt />
            <PageFade>{children}</PageFade>
            <FriendsDock />
          </AuthProvider>
        </LangProvider>
      </body>
    </html>
  );
}
