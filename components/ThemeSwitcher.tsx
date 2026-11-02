"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useT } from "@/lib/i18n";
import { COINS_CHANGED, loadInventory } from "@/lib/shop";
import { getSupabase } from "@/lib/supabase";
import { applyTheme, DEFAULT_THEME, savedTheme, THEME_CHANGED, themeById, THEMES } from "@/lib/themes";
import { HEADER_BTN, HEADER_MENU } from "./ui";

/** A palette button in the header: pick the colour of the site's background; the colours beyond wine and green are bought in the shop. */
export function ThemeSwitcher() {
  const t = useT();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<string>(DEFAULT_THEME);
  const [bought, setBought] = useState<{ userId: string; ids: string[] } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const userId = user?.id ?? null;
  const owned = useMemo(() => (bought && bought.userId === userId ? bought.ids : []), [bought, userId]);

  // read once on the client: the page script has already painted the saved theme
  useEffect(() => {
    const sync = () => setTheme(savedTheme());
    sync();
    window.addEventListener(THEME_CHANGED, sync);
    return () => window.removeEventListener(THEME_CHANGED, sync);
  }, []);

  // the colours this player has bought (reloaded after a purchase in the shop)
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    const load = () =>
      loadInventory(supabase, userId).then((ids) => {
        if (!cancelled) setBought({ userId, ids });
      });
    void load();
    window.addEventListener(COINS_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener(COINS_CHANGED, load);
    };
  }, [userId]);

  // a colour that is not (or no longer) this player's goes back to the free one
  useEffect(() => {
    if (loading) return;
    const current = themeById(theme);
    if (!current || current.free) return;
    const known = userId === null || (bought !== null && bought.userId === userId);
    if (known && !owned.includes(theme)) applyTheme(DEFAULT_THEME);
  }, [loading, theme, userId, bought, owned]);

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
    applyTheme(id);
    setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={t("ფონის ფერი", "Background colour", "Цвет фона")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`relative grid size-11 place-items-center min-[400px]:size-12 ${HEADER_BTN}`}
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
        <span
          className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full ring-2 ring-[var(--bg-b)]"
          style={{ background: themeById(theme)?.color }}
        />
      </button>
      {open && (
        <ul className={`${HEADER_MENU} w-48`}>
          {THEMES.map((th) => {
            const mine = th.free || owned.includes(th.id);
            const row = `flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold transition-colors hover:bg-white/10 ${th.id === theme ? "text-amber-300" : mine ? "text-white/80" : "text-white/45"}`;
            const dot = <span className="size-6 flex-none rounded-full ring-2 ring-white/30" style={{ background: th.color }} />;
            return (
              <li key={th.id}>
                {mine ? (
                  <button type="button" onClick={() => pick(th.id)} className={row}>
                    {dot}
                    {t(th.name[0], th.name[1], th.name[2])}
                  </button>
                ) : (
                  <Link href="/shop" onClick={() => setOpen(false)} className={row}>
                    {dot}
                    <span className="flex-1">{t(th.name[0], th.name[1], th.name[2])}</span>
                    <span aria-label={t("მაღაზიაში", "In the shop", "В магазине")}>🔒</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
