"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useT } from "@/lib/i18n";
import { Avatar } from "./Avatar";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { Logo } from "./Logo";

const NAV = [
  { href: "/leaderboard", ka: "ლიდერბორდი", en: "Leaderboard", ru: "Рейтинг" },
  { href: "/ranks", ka: "წოდებები", en: "Ranks", ru: "Ранги" },
];

/** Top bar of the hub pages: the brand on the left, the language, and the player (or a sign-in link) on the right. */
export function SiteHeader() {
  const { loading, user, profile, configured } = useAuth();
  const t = useT();
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-8">
        <Logo />
        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-base font-bold text-white/55 transition-colors hover:text-amber-300"
            >
              {t(n.ka, n.en, n.ru)}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2 min-[380px]:gap-3">
        <ThemeSwitcher />
        <LanguageSwitcher />
        {loading ? (
          <span className="h-12 w-40 animate-pulse rounded-full bg-white/10" />
        ) : user ? (
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-3 transition min-[380px]:pr-5-[border-color,background-color] duration-200 hover:border-white/30 hover:bg-white/[0.08]"
          >
            <Avatar size="sm" color={profile?.avatar_color} icon={profile?.avatar_icon} url={profile?.avatar_url} />
            <span className="max-w-24 truncate text-base font-bold min-[380px]:max-w-32">{profile?.nickname ?? t("პროფილი", "Profile", "Профиль")}</span>
          </Link>
        ) : (
          configured && (
            <Link
              href="/login"
              className="rounded-full border border-white/20 px-4 py-2.5 text-base min-[380px]:px-6 font-bold transition-[border-color,background-color,color] duration-200 hover:border-amber-300 hover:text-amber-300"
            >
              {t("შესვლა", "Sign in", "Войти")}
            </Link>
          )
        )}
      </div>
    </header>
  );
}
