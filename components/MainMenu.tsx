"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Card } from "@/lib/joker/cards";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useT } from "@/lib/i18n";
import { activeTable, openTableCounts, tablePath, type TableRow } from "@/lib/online/client";
import { loadResults } from "@/lib/results";
import { computeStats, type GameResult } from "@/lib/stats";
import { getSupabase } from "@/lib/supabase";
import { rankFor } from "@/lib/ranks";
import { loadRating, type RatingRow } from "@/lib/ratings";
import { Avatar } from "./Avatar";
import { Nick } from "./Nick";
import { GameCard } from "./GameCard";
import { RankEmblem } from "./RankEmblem";
import { FooterLinks } from "./FooterLinks";
import { SiteHeader } from "./SiteHeader";
import { ThemeFx } from "./ThemeFx";
import { RISE_CSS, rise } from "./ui";

const ACE: Card = { joker: false, suit: "S", rank: 14, id: "S14" };
const JOKER: Card = { joker: true, id: "J0" };
const KING: Card = { joker: false, suit: "H", rank: 13, id: "H13" };

/** A royal flush fanned out on the poker card. */
const POKER_FAN: Card[] = [12, 13, 14].map((rank) => ({ joker: false, suit: "H", rank: rank as 10, id: `H${rank}` }));

const JOKER_FAN: Card[] = [ACE, JOKER, KING];

const BURA_FAN: Card[] = [
  { joker: false, suit: "H", rank: 14, id: "H14" },
  { joker: false, suit: "H", rank: 10, id: "H10" },
  { joker: false, suit: "S", rank: 13, id: "S13" },
];

/** The nardi engine and page stay in the code; the menu card is hidden until the game is launched. */
const SHOW_NARDI = false;

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
  const [loaded, setLoaded] = useState<{ userId: string; results: GameResult[] } | null>(null);
  const [running, setRunning] = useState<{ userId: string; table: TableRow | null } | null>(null);
  const [ratings, setRatings] = useState<{ userId: string; rows: Partial<Record<"joker" | "bura", RatingRow | null>> } | null>(null);
  const [waiting, setWaiting] = useState<Partial<Record<TableRow["game"], number>>>({});

  const userId = user?.id ?? null;
  const results = loaded && loaded.userId === userId ? loaded.results : null;
  const stats = useMemo(() => (results ? computeStats(results) : null), [results]);
  const gameStats = (game: string) => (results ? computeStats(results.filter((r) => r.game === game)) : null);
  const myRatings = ratings && ratings.userId === userId ? ratings.rows : null;
  const runningTable = running && running.userId === userId ? running.table : null;

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    loadResults(supabase, userId).then(({ results }) => {
      if (!cancelled) setLoaded({ userId, results });
    });
    // a game still running (the page was closed, say) and the lobbies that wait for someone
    activeTable(supabase).then((table) => {
      if (!cancelled) setRunning({ userId, table });
    });
    Promise.all([loadRating(supabase, userId, "joker"), loadRating(supabase, userId, "bura")]).then(([joker, bura]) => {
      if (!cancelled) setRatings({ userId, rows: { joker, bura } });
    });
    openTableCounts(supabase).then((counts) => {
      if (!cancelled) setWaiting(counts);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const online = configured; // online play needs the database
  const loginFor = (path: string) => (user || !online ? path : `/login?next=${encodeURIComponent(path)}`);
  const waitingText = (n: number) => t(`${n} მაგიდა ელოდება`, `${n} ${n === 1 ? "table" : "tables"} waiting`, `Ждут столов: ${n}`);
  const line = (game: "joker" | "bura", fallback: string) => {
    const g = gameStats(game);
    return g && g.played > 0 ? `${g.played} ${t("თამაში", "games", "игр")} · ${g.wins} ${t("გამარჯვება", "wins", "побед")} · ${g.winRate}%` : fallback;
  };
  const resumeFor = (game: TableRow["game"]) =>
    runningTable?.game === game ? { href: tablePath(runningTable), text: t("გააგრძელეთ თამაში", "Resume your game", "Вернуться в игру") } : undefined;
  const botsText = t("ბოტებთან", "Vs bots", "С ботами");
  const onlineText = t("ონლაინ", "Online", "Онлайн");

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[radial-gradient(ellipse_at_50%_-10%,var(--bg-a),var(--bg-b)_70%)]">
      <style>{RISE_CSS}</style>
      <ThemeFx />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-5 py-6 sm:gap-12 sm:px-8 sm:py-8">
        <div className="relative z-30" style={rise(0)}>
          <SiteHeader />
        </div>

        <section className="flex items-center gap-4 sm:gap-6" style={rise(1)}>
          {user && (
            <Link href="/profile" aria-label={t("პროფილი", "Profile", "Профиль")} className="flex-none transition-transform duration-300 hover:scale-105 max-sm:[&_.avatar-face]:size-16! max-sm:[&_.avatar-face]:text-3xl!">
              <Avatar size="lg" color={profile?.avatar_color} icon={profile?.avatar_icon} url={profile?.avatar_url} frame={profile?.equipped_frame} />
            </Link>
          )}
          <div className="flex min-w-0 flex-col gap-3">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight min-[400px]:text-3xl sm:text-6xl">
              {user ? (
                <>
                  {t("გამარჯობა", "Hello", "Привет")}, <span className="text-amber-300"><Nick name={profile?.nickname ?? t("მოთამაშე", "Player", "Игрок")} style={profile?.equipped_name} /></span>
                </>
              ) : (
                t("თამაშები", "Games", "Игры")
              )}
            </h1>
            <p className="text-sm text-white/55 min-[400px]:text-base sm:text-xl">
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
            {user && (
              <div className="flex min-h-9 flex-wrap gap-2">
                {myRatings &&
                  (["joker", "bura"] as const).map((g) => {
                    const row = myRatings[g];
                    if (!row) return null;
                    const { rank } = rankFor(row.rating);
                    return (
                      <span key={g} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] py-1 pl-2 pr-3.5 text-sm font-bold text-white/80">
                        <RankEmblem rank={rank} className="h-7 w-6" glow={false} compact />
                        {g === "joker" ? t("ჯოკერი", "Joker", "Джокер") : t("ბურა", "Bura", "Бура")} · {rank.name} · {row.rating}
                      </span>
                    );
                  })}
              </div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-[repeat(2,minmax(0,1fr))] sm:gap-8 lg:grid-cols-[repeat(3,minmax(0,1fr))] lg:gap-6" style={rise(2)}>
          <GameCard
            title={t("ბურა", "Bura", "Бура")}
            href="/bura"
            cards={BURA_FAN}
            accent="#34d399"
            badges={[t("2 ან 4 მოთამაშე", "2 or 4 players", "2 или 4 игрока")]}
            line={line("bura", t("ონლაინ და ბოტებთან", "Online and vs bots", "Онлайн и с ботами"))}
            waiting={waiting.bura}
            waitingText={waitingText(waiting.bura ?? 0)}
            resume={resumeFor("bura")}
            botsHref="/bura/bots"
            botsText={botsText}
            ribbon={t("ტესტის რეჟიმში", "In testing", "В тестировании")}
            online={online ? { href: "/bura", text: onlineText } : undefined}
          />

          <GameCard
            title={t("ჯოკერი", "Joker", "Джокер")}
            href="/joker"
            cards={JOKER_FAN}
            front={1}
            accent="#fbbf24"
            badges={[t("4 მოთამაშე", "4 players", "4 игрока")]}
            line={line("joker", t("ონლაინ და ბოტებთან", "Online and vs bots", "Онлайн и с ботами"))}
            waiting={waiting.joker}
            waitingText={waitingText(waiting.joker ?? 0)}
            resume={resumeFor("joker")}
            botsHref="/joker/bots"
            botsText={botsText}
            online={online ? { href: "/joker", text: onlineText } : undefined}
          />

          <GameCard
            title={t("პოკერი", "Poker", "Покер")}
            href="/poker"
            cards={POKER_FAN}
            accent="#60a5fa"
            badges={[t("2-6 მოთამაშე", "2-6 players", "2-6 игроков"), t("სათამაშო ჩიპები", "Play chips", "Игровые фишки")]}
            line={t("Texas Hold'em, ფული არ გამოიყენება", "Texas Hold'em, no real money", "Texas Hold'em, без денег")}
            waiting={waiting.poker}
            waitingText={waitingText(waiting.poker ?? 0)}
            resume={resumeFor("poker")}
            botsHref="/poker/bots"
            botsText={botsText}
            ribbon={t("ტესტის რეჟიმში", "In testing", "В тестировании")}
            online={online ? { href: loginFor("/poker/private"), text: onlineText } : undefined}
          />

          {/* not open yet: dimmed and not a link; hidden from the menu until SHOW_NARDI is turned on */}
          {SHOW_NARDI && (
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
          )}
        </section>

        {!configured && (
          <p className="text-sm text-white/40">
            {t("პროფილები ჯერ არ არის ჩართული (Supabase არ არის მიერთებული), მაგრამ ჯოკერის თამაში შეიძლება.", "Profiles are not enabled yet (Supabase is not connected), but you can still play Joker.", "Профили пока не включены (Supabase не подключён), но в Джокер играть можно.")}
          </p>
        )}
        <FooterLinks />
      </div>
    </main>
  );
}
