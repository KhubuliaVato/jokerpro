"use client";

import { useEffect, useRef, useState } from "react";
import { LANGS, useLang, type Lang } from "@/lib/i18n";

const CROSSES = [
  [5.2, 5.2],
  [18.8, 5.2],
  [5.2, 18.8],
  [18.8, 18.8],
];

/** Small round flags drawn in SVG (emoji flags do not render on Windows). */
export function Flag({ lang, className = "size-6" }: { lang: Lang; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0 rounded-full`} aria-hidden>
      <defs>
        <clipPath id={`flag-${lang}`}>
          <circle cx="12" cy="12" r="12" />
        </clipPath>
      </defs>
      <g clipPath={`url(#flag-${lang})`}>
        {lang === "ka" && (
          <>
            <rect width="24" height="24" fill="#fff" />
            <path d="M10.4 0h3.2v24h-3.2zM0 10.4h24v3.2H0z" fill="#e8112d" />
            {CROSSES.map(([x, y]) => (
              <path key={`${x}${y}`} d={`M${x - 0.8} ${y - 2.4}h1.6v1.6h1.6v1.6h-1.6v1.6h-1.6v-1.6h-1.6v-1.6h1.6z`} fill="#e8112d" />
            ))}
          </>
        )}
        {lang === "en" && (
          <>
            <rect width="24" height="24" fill="#1d3a8a" />
            <path d="M0 0l24 24M24 0L0 24" stroke="#fff" strokeWidth="4.5" />
            <path d="M0 0l24 24M24 0L0 24" stroke="#d52b3a" strokeWidth="1.6" />
            <path d="M12 0v24M0 12h24" stroke="#fff" strokeWidth="7" />
            <path d="M12 0v24M0 12h24" stroke="#d52b3a" strokeWidth="4" />
          </>
        )}
        {lang === "ru" && (
          <>
            <rect width="24" height="8" fill="#fff" />
            <rect y="8" width="24" height="8" fill="#1c57a5" />
            <rect y="16" width="24" height="8" fill="#d52b1e" />
          </>
        )}
      </g>
      <circle cx="12" cy="12" r="11.6" fill="none" stroke="rgb(255 255 255 / 0.35)" strokeWidth="0.8" />
    </svg>
  );
}

/** The flag of the current language; opens a small list to switch. */
export function LanguageSwitcher() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label="Language"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid size-12 place-items-center rounded-full border border-white/10 bg-white/[0.04] transition-[border-color,background-color] duration-200 hover:border-white/30 hover:bg-white/[0.08]"
      >
        <Flag lang={lang} className="size-7" />
      </button>
      {open && (
        <ul className="absolute right-0 top-14 z-40 w-44 overflow-hidden rounded-2xl border border-white/15 bg-[#0c2a1d] p-1.5 shadow-2xl">
          {LANGS.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => {
                  setLang(l.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold transition-colors hover:bg-white/10 ${l.id === lang ? "text-amber-300" : "text-white/80"}`}
              >
                <Flag lang={l.id} className="size-6" />
                {l.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
