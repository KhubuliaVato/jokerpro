"use client";

import { usePathname } from "next/navigation";

/** Fades each page in when the route changes (opacity only, so fixed-position children are unaffected). */
export function PageFade({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} style={{ animation: "page-fade 0.35s ease-out both" }}>
      <style>{`@keyframes page-fade{from{opacity:0}to{opacity:1}}`}</style>
      {children}
    </div>
  );
}
