"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

/** The small line at the bottom of the hub pages. */
export function FooterLinks() {
  const t = useT();
  return (
    <footer className="mt-auto pt-6 text-center text-xs text-white/40">
      <Link href="/rules" className="underline underline-offset-4 hover:text-amber-300">
        {t("წესები", "Rules", "Правила")}
      </Link>
      <span className="mx-2">·</span>
      <Link href="/privacy" className="underline underline-offset-4 hover:text-amber-300">
        {t("კონფიდენციალურობის პოლიტიკა", "Privacy Policy", "Политика конфиденциальности")}
      </Link>
    </footer>
  );
}
