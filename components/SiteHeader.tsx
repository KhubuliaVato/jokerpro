"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useT } from "@/lib/i18n";
import { Avatar } from "./Avatar";
import { Nick } from "./Nick";
import { CoinBalance } from "./Coins";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { Logo } from "./Logo";
import { HEADER_BTN } from "./ui";

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
    href: "/rules",
    ka: "წესები",
    en: "Rules",
    ru: "Правила",
    icon: (
      <svg viewBox="0 0 24 24" {...ICON}>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16z" />
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      </svg>
    ),
  },
  {
    href: "/shop",
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
];

/** Top bar of the hub pages: the brand on the left, the language, and the player (or a sign-in link) on the right. */
export function SiteHeader() {
  const { loading, user, profile, configured } = useAuth();
  const t = useT();
  const path = usePathname();
  return (
    <header className="@container flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-4 lg:gap-5">
        <Logo hideWordOnPhones />
        <nav className="hidden items-center gap-1.5 md:flex">
          {NAV.map((n) => {
            const active = path === n.href || path.startsWith(`${n.href}/`);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                aria-label={t(n.ka, n.en, n.ru)}
                title={t(n.ka, n.en, n.ru)}
                className={`group flex items-center gap-2 rounded-full border px-3 py-2.5 text-base font-bold transition-[color,background-color,border-color,translate,box-shadow] duration-200 hover:-translate-y-0.5 ${
                  active
                    ? "border-amber-300/60 bg-amber-300/15 text-amber-200 shadow-[0_8px_24px_-12px_rgb(252_211_77/0.6)]"
                    : "border-white/10 bg-white/[0.04] text-white/65 hover:border-amber-300/40 hover:bg-white/[0.08] hover:text-amber-200"
                }`}
              >
                <span className="transition-transform duration-200 group-hover:scale-110">{n.icon}</span>
                <span className="hidden @[900px]:inline">{t(n.ka, n.en, n.ru)}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-2 min-[380px]:gap-2.5">
        <CoinBalance />
        <ThemeSwitcher />
        <LanguageSwitcher />
        {loading ? (
          <span className="h-12 w-40 animate-pulse rounded-full bg-white/10" />
        ) : user ? (
          <Link
            href="/profile"
            className={`group flex items-center gap-3 p-1.5 @[1100px]:pr-5 ${HEADER_BTN}`}
          >
            <span className="rounded-full ring-2 ring-amber-300/60 transition-shadow duration-200 group-hover:ring-amber-300">
              <Avatar size="sm" color={profile?.avatar_color} icon={profile?.avatar_icon} url={profile?.avatar_url} frame={profile?.equipped_frame} />
            </span>
            <span className="hidden max-w-32 truncate text-base font-bold @[1100px]:inline"><Nick name={profile?.nickname ?? t("პროფილი", "Profile", "Профиль")} style={profile?.equipped_name} /></span>
          </Link>
        ) : (
          configured && (
            <Link
              href="/login"
              className="rounded-full bg-amber-300 px-4 py-2.5 text-base font-extrabold text-black transition-[background-color,translate] duration-200 hover:-translate-y-0.5 hover:bg-amber-200 min-[380px]:px-6"
            >
              {t("შესვლა", "Sign in", "Войти")}
            </Link>
          )
        )}
      </div>
    </header>
  );
}
