"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useIsAdmin } from "@/lib/admin";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useT } from "@/lib/i18n";
import { Avatar } from "./Avatar";
import { CoinBalance } from "./Coins";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { Logo } from "./Logo";

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, className: "size-5 flex-none" } as const;

const NAV = [
  {
    href: "/leaderboard",
    ka: "ლიდერბორდი",
    en: "Leaderboard",
    ru: "Рейтинг",
    icon: (
      <svg viewBox="0 0 24 24" {...ICON}>
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
        <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
      </svg>
    ),
  },
  {
    href: "/ranks",
    ka: "წოდებები",
    en: "Ranks",
    ru: "Ранги",
    icon: (
      <svg viewBox="0 0 24 24" {...ICON}>
        <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
        <path d="M9 11l3 2.5L15 11" />
      </svg>
    ),
  },
  {
    href: "/shop",
    /** Only for signed-in players: a guest has no coins to spend. */
    signedIn: true,
    ka: "მაღაზია",
    en: "Shop",
    ru: "Магазин",
    icon: (
      <svg viewBox="0 0 24 24" {...ICON}>
        <path d="M5 8h14l-1 12H6L5 8z" />
        <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
      </svg>
    ),
  },
  {
    href: "/admin",
    /** Only for admins. */
    adminOnly: true,
    ka: "ადმინი",
    en: "Admin",
    ru: "Админ",
    icon: (
      <svg viewBox="0 0 24 24" {...ICON}>
        <path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" />
        <path d="M9.5 12.5l2 2 3.5-4" />
      </svg>
    ),
  },
];

/** Top bar of the hub pages: the brand on the left, the language, and the player (or a sign-in link) on the right. */
export function SiteHeader() {
  const { loading, user, profile, configured } = useAuth();
  const t = useT();
  const path = usePathname();
  const isAdmin = useIsAdmin();
  return (
    <header className="@container flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-4 lg:gap-5">
        <Logo hideWordOnPhones />
        <nav className="hidden items-center gap-1.5 md:flex">
          {NAV.filter((n) => (!n.signedIn || user) && (!n.adminOnly || isAdmin)).map((n) => {
            const active = path === n.href || path.startsWith(`${n.href}/`);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                aria-label={t(n.ka, n.en, n.ru)}
                title={t(n.ka, n.en, n.ru)}
                className={`group relative flex h-10 items-center gap-2 rounded-xl border px-3 text-[0.95rem] font-bold transition-[color,background-color,border-color,box-shadow] duration-200 ${
                  active
                    ? "border-amber-300/30 bg-amber-300/[0.08] text-amber-200 after:absolute after:inset-x-3 after:-bottom-px after:h-px after:bg-gradient-to-r after:from-transparent after:via-amber-300 after:to-transparent"
                    : "border-transparent text-white/60 hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <span className="transition-transform duration-200 group-hover:scale-110">{n.icon}</span>
                <span className="hidden @[900px]:inline">{t(n.ka, n.en, n.ru)}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-none items-center gap-2 min-[380px]:gap-2.5">
        <CoinBalance />
        <ThemeSwitcher />
        <LanguageSwitcher />
        {loading ? (
          <span className="size-11 animate-pulse rounded-full bg-white/10" />
        ) : user ? (
          <Link
            href="/profile"
            className="group flex size-11 flex-none items-center justify-center rounded-full transition-[translate,filter] duration-200 hover:-translate-y-0.5 hover:brightness-110"
          >
            <span className="flex flex-none rounded-full ring-2 ring-amber-300/60 transition-shadow duration-200 group-hover:ring-amber-300">
              <Avatar size="sm" color={profile?.avatar_color} icon={profile?.avatar_icon} url={profile?.avatar_url} frame={profile?.equipped_frame} />
            </span>
          </Link>
        ) : (
          configured && (
            <Link
              href="/login"
              className="flex h-10 items-center rounded-xl bg-amber-300 px-4 text-[0.95rem] font-extrabold text-black shadow-[0_8px_20px_-12px_rgb(252_211_77/0.7)] transition-[background-color,translate] duration-200 hover:-translate-y-0.5 hover:bg-amber-200 min-[380px]:px-5"
            >
              {t("შესვლა", "Sign in", "Войти")}
            </Link>
          )
        )}
        <MobileMenu items={NAV.filter((n) => (!n.signedIn || user) && (!n.adminOnly || isAdmin))} />
      </div>
    </header>
  );
}

/** On a phone the links do not fit in the bar: a burger at the far right opens them as a list. */
function MobileMenu({ items }: { items: typeof NAV }) {
  const t = useT();
  const path = usePathname();
  // remembers on which page it was opened, so that going to another page closes it by itself
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        aria-label={t("მენიუ", "Menu", "Меню")}
        aria-expanded={open}
        onClick={() => setOpenOn(open ? null : path)}
        className={`grid size-11 flex-none place-items-center rounded-full border transition-colors duration-200 ${
          open ? "border-amber-300/60 bg-amber-300/15 text-amber-200" : "border-white/12 bg-white/[0.05] text-white/80 active:bg-white/10"
        }`}
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M4 7h16" className="origin-center transition-transform duration-300" style={open ? { transform: "translateY(5px) rotate(45deg)" } : undefined} />
          <path d="M4 12h16" className="transition-opacity duration-200" style={{ opacity: open ? 0 : 1 }} />
          <path d="M4 17h16" className="origin-center transition-transform duration-300" style={open ? { transform: "translateY(-5px) rotate(-45deg)" } : undefined} />
        </svg>
      </button>
      {open && (
        <>
          <button type="button" aria-label={t("დახურვა", "Close", "Закрыть")} tabIndex={-1} onClick={() => setOpenOn(null)} className="fixed inset-0 z-40 cursor-default bg-black/40 backdrop-blur-[2px]" />
          <nav
            aria-label={t("მენიუ", "Menu", "Меню")}
            className="absolute right-0 top-full z-50 mt-3 flex w-[min(19rem,calc(100vw-2rem))] origin-top-right flex-col gap-1 rounded-3xl border border-white/15 bg-[#0d0a1f]/95 p-2 shadow-[0_28px_70px_-18px_rgb(0_0_0/0.85)] backdrop-blur-xl"
            style={{ animation: "sort-pop 0.18s ease-out both" }}
          >
            {items.map((n) => {
              const active = path === n.href || path.startsWith(`${n.href}/`);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-14 items-center gap-3.5 rounded-2xl px-4 text-base font-extrabold transition-colors ${
                    active ? "bg-amber-300 text-black" : "text-white/85 active:bg-white/10"
                  }`}
                >
                  {n.icon}
                  {t(n.ka, n.en, n.ru)}
                </Link>
              );
            })}
          </nav>
        </>
      )}
    </div>
  );
}
