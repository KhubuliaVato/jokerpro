"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

/** Background colours of the site; the values live in globals.css under [data-theme]. */
export const THEMES = [
  { id: "green", color: "#1f7a4d", name: ["მწვანე", "Green", "Зелёный"] },
  { id: "blue", color: "#25588f", name: ["ლურჯი", "Blue", "Синий"] },
  { id: "purple", color: "#5a3392", name: ["იისფერი", "Purple", "Фиолетовый"] },
  { id: "wine", color: "#8a2540", name: ["ღვინისფერი", "Wine", "Бордовый"] },
  { id: "graphite", color: "#454b55", name: ["გრაფიტი", "Graphite", "Графит"] },
] as const;

const KEY = "theme";

function apply(id: string) {
  document.documentElement.dataset.theme = id;
}

/** A palette button in the header: pick the colour of the site's background (remembered in this browser). */
export function ThemeSwitcher() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("green");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      // read once on the client: the page script has already painted the saved theme
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && THEMES.some((x) => x.id === saved)) setTheme(saved);
    } catch {
      // private mode: the colour just is not remembered
    }
  }, []);

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

  const pick = (id: string) => {
    setTheme(id);
    apply(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // not remembered
    }
    setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={t("ფონის ფერი", "Background colour", "Цвет фона")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/[0.04] transition-[border-color,background-color] duration-200 hover:border-white/30 hover:bg-white/[0.08] min-[400px]:size-12"
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden>
          <path
            d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-1.2-1-1.4-1-2.5 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3z"
            stroke="#fcd34d"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <circle cx="7.5" cy="11" r="1.4" fill="#fb7185" />
          <circle cx="10.5" cy="7.2" r="1.4" fill="#fcd34d" />
          <circle cx="15" cy="7.8" r="1.4" fill="#34d399" />
        </svg>
      </button>
      {open && (
        <ul className="absolute right-0 top-14 z-40 w-48 overflow-hidden rounded-2xl border border-white/15 bg-[#10161c] p-1.5 shadow-2xl">
          {THEMES.map((th) => (
            <li key={th.id}>
              <button
                type="button"
                onClick={() => pick(th.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold transition-colors hover:bg-white/10 ${th.id === theme ? "text-amber-300" : "text-white/80"}`}
              >
                <span className="size-6 flex-none rounded-full ring-2 ring-white/30" style={{ background: th.color }} />
                {t(th.name[0], th.name[1], th.name[2])}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
