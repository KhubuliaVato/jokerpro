"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Card } from "@/lib/joker/cards";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useT } from "@/lib/i18n";
import { loadResults } from "@/lib/results";
import { computeStats, type Stats } from "@/lib/stats";
import { getSupabase } from "@/lib/supabase";
import { CardView } from "./CardView";
import { SiteHeader } from "./SiteHeader";
import { RISE_CSS, rise } from "./ui";

const ACE: Card = { joker: false, suit: "S", rank: 14, id: "S14" };
const JOKER: Card = { joker: true, id: "J0" };
const KING: Card = { joker: false, suit: "H", rank: 13, id: "H13" };

/** A royal flush fanned out on the poker card. */
const POKER_FAN: Card[] = [10, 11, 12, 13, 14].map((rank) => ({ joker: false, suit: "H", rank: rank as 10, id: `H${rank}` }));

const BURA_FAN: Card[] = [
  { joker: false, suit: "H", rank: 14, id: "H14" },
  { joker: false, suit: "H", rank: 10, id: "H10" },
  { joker: false, suit: "S", rank: 13, id: "S13" },
];

const CARD_SIZE = { ["--cw" as string]: "clamp(5.5rem, 14vw, 7.5rem)" } as React.CSSProperties;

/** A tiny nardi board on the menu card: a row of points with a few checkers and two dice. */
function NardiArt() {
  const tri = (i: number, top: boolean) => {
    const x = 6 + i * 20;
    return <polygon key={`${i}${top}`} points={top ? `${x},4 ${x + 18},4 ${x + 9},50` : `${x},96 ${x + 18},96 ${x + 9},50`} fill={(i + (top ? 0 : 1)) % 2 ? "#8b3a2f" : "#d9b878"} />;
  };
  return (
    <svg viewBox="0 0 252 100" className="h-full max-w-full " aria-hidden>
      <rect x="0" y="0" width="252" height="100" rx="12" fill="#6b4423" />
      <rect x="4" y="2" width="244" height="96" rx="8" fill="#12362a" />
      {Array.from({ length: 12 }, (_, i) => tri(i, true))}
      {Array.from({ length: 12 }, (_, i) => tri(i, false))}
      {[0, 1, 2].map((k) => <circle key={`w${k}`} cx="235" cy={14 + k * 11} r="5.3" fill="#f5efe0" stroke="#b9ad92" />)}
      {[0, 1].map((k) => <circle key={`b${k}`} cx="15" cy={86 - k * 11} r="5.3" fill="#26262c" stroke="#000" />)}
      <circle cx="75" cy="14" r="5.3" fill="#f5efe0" stroke="#b9ad92" />
      <circle cx="175" cy="86" r="5.3" fill="#26262c" stroke="#000" />
      <g transform="translate(106 38) rotate(-10 12 12)">
        <rect width="24" height="24" rx="5" fill="#fbf8ef" stroke="#bbb2a0" />
        <circle cx="7" cy="7" r="2.2" fill="#1d1d24" /><circle cx="17" cy="17" r="2.2" fill="#1d1d24" /><circle cx="12" cy="12" r="2.2" fill="#1d1d24" />
      </g>
      <g transform="translate(138 40) rotate(12 12 12)">
        <rect width="24" height="24" rx="5" fill="#fbf8ef" stroke="#bbb2a0" />
        <circle cx="7" cy="7" r="2.2" fill="#1d1d24" /><circle cx="17" cy="7" r="2.2" fill="#1d1d24" /><circle cx="7" cy="17" r="2.2" fill="#1d1d24" /><circle cx="17" cy="17" r="2.2" fill="#1d1d24" />
      </g>
    </svg>
  );
}

export function MainMenu() {
  const { user, profile, configured } = useAuth();
  const t = useT();
  const [loaded, setLoaded] = useState<{ userId: string; stats: Stats } | null>(null);

  const userId = user?.id ?? null;
  const stats = loaded && loaded.userId === userId ? loaded.stats : null;
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    loadResults(supabase, userId).then(({ results }) => {
      if (!cancelled) setLoaded({ userId, stats: computeStats(results) });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[radial-gradient(ellipse_at_50%_-10%,#17623f,#0a2418_70%)]">
      <style>{RISE_CSS}</style>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-5 py-6 sm:gap-12 sm:px-8 sm:py-8">
        <div className="relative z-30" style={rise(0)}>
          <SiteHeader />
        </div>

        <section className="flex flex-col gap-3" style={rise(1)}>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            {user ? (
              <>
                {t("გამარჯობა", "Hello", "Привет")}, <span className="text-amber-300">{profile?.nickname ?? t("მოთამაშე", "Player", "Игрок")}</span>
              </>
            ) : (
              t("თამაშები", "Games", "Игры")
            )}
          </h1>
          <p className="text-lg text-white/55 sm:text-xl">
            {user && stats && stats.played > 0 ? (
              <>
                {stats.played} {t("თამაში", "games", "игр")} · {stats.wins} {t("გამარჯვება", "wins", "побед")} · {stats.winRate}%
              </>
            ) : user ? (
              t("აირჩიეთ თამაში და დაიწყეთ.", "Pick a game and get started.", "Выберите игру и начинайте.")
            ) : (
              t("აირჩიეთ თამაში.", "Pick a game.", "Выберите игру.")
            )}
          </p>
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-[repeat(2,minmax(0,1fr))] sm:gap-8" style={rise(2)}>
          <Link href="/joker" className="group block outline-none">
            <div className="flex min-h-[min(28rem,50dvh)] flex-col justify-between rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 transition-[translate,border-color,background-color,box-shadow] duration-300 ease-out group-hover:-translate-y-2 group-hover:border-white/30 group-hover:bg-white/[0.07] group-hover:shadow-[0_30px_60px_-20px_rgb(0_0_0/0.6)] group-focus-visible:border-amber-300 sm:p-9">
              <div className="relative grid flex-1 place-items-center py-6">
                <div className="relative h-44 w-full">
                  <div className="absolute bottom-0 left-1/2 origin-bottom -translate-x-[calc(50%+3.6rem)] -rotate-[9deg] transition-[rotate,translate] duration-500 ease-out group-hover:-translate-x-[calc(50%+5.2rem)] group-hover:-rotate-[17deg]">
                    <CardView card={ACE} style={CARD_SIZE} />
                  </div>
                  <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 transition-[translate] duration-500 ease-out group-hover:-translate-y-4">
                    <CardView card={JOKER} style={CARD_SIZE} />
                  </div>
                  <div className="absolute bottom-0 left-1/2 origin-bottom -translate-x-[calc(50%-3.6rem)] rotate-[9deg] transition-[rotate,translate] duration-500 ease-out group-hover:-translate-x-[calc(50%-5.2rem)] group-hover:rotate-[17deg]">
                    <CardView card={KING} style={CARD_SIZE} />
                  </div>
                </div>
              </div>
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-3xl font-extrabold min-[360px]:text-4xl sm:text-5xl">{t("ჯოკერი", "Joker", "Джокер")}</h2>
                  <p className="mt-1.5 text-base text-white/55">{t("ონლაინ და ბოტებთან · 4 მოთამაშე", "Online and vs bots · 4 players", "Онлайн и с ботами · 4 игрока")}</p>
                </div>
                <span className="flex items-center gap-2 whitespace-nowrap text-lg font-bold text-amber-300">
                  {t("თამაში", "Play", "Играть")}
                  <span className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
                </span>
              </div>
            </div>
          </Link>

          <Link href="/bura" className="group block outline-none">
            <div className="flex min-h-[min(28rem,50dvh)] flex-col justify-between rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 transition-[translate,border-color,background-color,box-shadow] duration-300 ease-out group-hover:-translate-y-2 group-hover:border-white/30 group-hover:bg-white/[0.07] group-hover:shadow-[0_30px_60px_-20px_rgb(0_0_0/0.6)] group-focus-visible:border-amber-300 sm:p-9">
              <div className="relative grid flex-1 place-items-center py-6">
                <div className="relative h-44 w-full">
                  {BURA_FAN.map((card, i) => (
                    <div
                      key={card.id}
                      className="absolute bottom-0 left-1/2 origin-bottom transition-[rotate,translate] duration-500 ease-out"
                      style={{
                        rotate: `calc(${i - 1} * var(--spread, 9deg))`,
                        translate: `calc(-50% + ${i - 1} * var(--gap, 3.6rem)) 0`,
                        zIndex: i,
                      }}
                    >
                      <CardView card={card} style={CARD_SIZE} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-3xl font-extrabold min-[360px]:text-4xl sm:text-5xl">{t("ბურა", "Bura", "Бура")}</h2>
                  <p className="mt-1.5 text-base text-white/55">{t("ონლაინ და ბოტებთან · 2 ან 4 მოთამაშე", "Online and vs bots · 2 or 4 players", "Онлайн и с ботами · 2 или 4 игрока")}</p>
                </div>
                <span className="flex items-center gap-2 whitespace-nowrap text-lg font-bold text-amber-300">
                  {t("თამაში", "Play", "Играть")}
                  <span className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
                </span>
              </div>
            </div>
          </Link>

          <Link href="/poker" className="group block outline-none">
            <div className="flex min-h-[min(18rem,40dvh)] flex-col justify-between gap-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 transition-[translate,border-color,background-color,box-shadow] duration-300 ease-out group-hover:-translate-y-2 group-hover:border-white/30 group-hover:bg-white/[0.07] group-hover:shadow-[0_30px_60px_-20px_rgb(0_0_0/0.6)] group-focus-visible:border-amber-300 sm:p-9">
              <div className="relative h-28 w-full sm:h-32">
                {POKER_FAN.map((card, i) => (
                  <div
                    key={card.id}
                    className="absolute bottom-0 left-1/2 origin-bottom transition-[rotate,translate] duration-500 ease-out"
                    style={{
                      rotate: `calc(${i - 2} * var(--spread, 7deg))`,
                      translate: `calc(-50% + ${i - 2} * var(--gap, 2.6rem)) 0`,
                      zIndex: i,
                    }}
                  >
                    <CardView card={card} style={{ "--cw": "4.2rem" } as React.CSSProperties} />
                  </div>
                ))}
              </div>
              <div className="flex min-w-0 flex-1 items-end justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-3xl font-extrabold min-[360px]:text-4xl sm:text-5xl">{t("პოკერი", "Poker", "Покер")}</h2>
                  <p className="mt-1.5 text-base text-white/55">{t("Texas Hold'em ბოტებთან · სათამაშო ჩიპებით", "Texas Hold'em vs bots · play chips", "Texas Hold'em с ботами · игровые фишки")}</p>
                </div>
                <span className="flex items-center gap-2 whitespace-nowrap text-lg font-bold text-amber-300">
                  {t("თამაში", "Play", "Играть")}
                  <span className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
                </span>
              </div>
            </div>
          </Link>

          {/* not open yet: dimmed and not a link */}
          <div aria-disabled className="block cursor-not-allowed select-none opacity-45 saturate-50">
            <div className="flex min-h-[min(18rem,40dvh)] flex-col justify-between gap-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 sm:p-9">
              <div className="relative grid h-28 w-full place-items-center sm:h-32">
                <NardiArt />
              </div>
              <div className="flex min-w-0 flex-1 items-end justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-3xl font-extrabold min-[360px]:text-4xl sm:text-5xl">{t("ნარდი", "Nardi", "Нарды")}</h2>
                  <p className="mt-1.5 text-base text-white/55">{t("ნარდი ბოტებთან", "Nardi vs bots", "Нарды с ботами")}</p>
                </div>
                <span className="whitespace-nowrap rounded-full border border-white/25 px-3 py-1 text-sm font-bold text-white/80">
                  {t("მალე დაემატება", "Coming soon", "Скоро")}
                </span>
              </div>
            </div>
          </div>
        </section>

        {!configured && (
          <p className="text-sm text-white/40">
            {t("პროფილები ჯერ არ არის ჩართული (Supabase არ არის მიერთებული), მაგრამ ჯოკერის თამაში შეიძლება.", "Profiles are not enabled yet (Supabase is not connected), but you can still play Joker.", "Профили пока не включены (Supabase не подключён), но в Джокер играть можно.")}
          </p>
        )}
      </div>
    </main>
  );
}
