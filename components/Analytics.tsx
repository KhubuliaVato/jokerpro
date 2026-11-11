"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useLang } from "@/lib/i18n";
import { trackVisit } from "@/lib/analytics";

/** Counts the page views of the site (nothing personal is kept; the admin panel shows the totals). */
export function Analytics() {
  const path = usePathname();
  const { lang } = useLang();
  useEffect(() => {
    trackVisit(path, lang);
  }, [path, lang]);
  return null;
}
