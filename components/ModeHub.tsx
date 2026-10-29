"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { activeTable, tablePath, type TableRow } from "@/lib/online/client";
import { rankFor, RANKS } from "@/lib/ranks";
import { loadPosition, loadRating, type RatingRow } from "@/lib/ratings";
import { loadResults } from "@/lib/results";
import { computeStats, type GameResult } from "@/lib/stats";
import { getSupabase } from "@/lib/supabase";
import { Avatar } from "./Avatar";
import { PageShell } from "./PageShell";
import { RankEmblem } from "./RankEmblem";
import { BTN_PRIMARY, rise } from "./ui";

const NAME = { joker: "ჯოკერი", bura: "ბურა", poker: "პოკერი" } as const;

/** The four ways into a game (Joker or Bura), next to the player's own rank and numbers. */
export function ModeHub({ game }: { game: "joker" | "bura" }) {
  const { user, configured } = useAuth();
  const [loaded, setLoaded] = useState<{ userId: string; row: RatingRow | null } | null>(null);

  const userId = user?.id ?? null;
  const rating = loaded && loaded.userId === userId ? loaded.row : null;
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    loadRating(supabase, userId, game).then((row) => {
      if (!cancelled) setLoaded({ userId, row });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, game]);

  // The numbers of the profile card: the finished games of this game and the place on its leaderboard.
  const [mine, setMine] = useState<{ userId: string; game: string; results: GameResult[]; position: number | null } | null>(null);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    Promise.all([loadResults(supabase, userId), loadPosition(supabase, userId, game)]).then(([r, position]) => {
      if (!cancelled) setMine({ userId, game, results: r.results.filter((x) => x.game === game), position });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, game]);
  const numbers = mine && mine.userId === userId && mine.game === game ? mine : null;

  // A game that is still running (the page was closed, say): offer the way back.
  const [running, setRunning] = useState<{ userId: string; table: TableRow | null } | null>(null);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    activeTable(supabase).then((t) => {
      if (!cancelled) setRunning({ userId, table: t });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  const runningTable = running && running.userId === userId ? running.table : null;

  const current = rankFor(rating?.rating ?? 50).rank;
  const online = configured; // the three online modes need the database and an account
  const loginFor = (path: string) => (user || !online ? path : `/login?next=${encodeURIComponent(path)}`);

  return (
    <PageShell width="max-w-5xl">
      <section className="flex flex-col gap-2" style={rise(1)}>
        <p className="text-sm font-bold uppercase tracking-wider text-white/45">{NAME[game]}</p>
        <h1 className="text-[clamp(1.8rem,11.5vw,3rem)] font-extrabold tracking-tight sm:text-7xl">აირჩიეთ რეჟიმი</h1>
      </section>

      {runningTable && (
        <Link
          href={tablePath(runningTable)}
          className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-400/50 bg-emerald-400/10 px-5 py-4 transition-colors hover:bg-emerald-400/15"
          style={rise(1)}
        >
          <span>
            <b className="block text-lg text-emerald-300">თამაში გრძელდება</b>
            <span className="text-white/60">{NAME[runningTable.game]} · დაბრუნდით თქვენს მაგიდასთან</span>
          </span>
          <span className="text-2xl text-emerald-300">→</span>
        </Link>
      )}

      <div
        className={`grid grid-cols-[minmax(0,1fr)] gap-5 pb-8 lg:items-start lg:gap-8 ${online ? "lg:grid-cols-[21rem_minmax(0,1fr)]" : ""}`}
        style={rise(2)}
      >
        {online && (
          <ProfileCard
            game={game}
            rating={rating}
            results={numbers?.results ?? null}
            position={numbers?.position ?? null}
            loginHref={loginFor(`/${game}`)}
          />
        )}
        <section className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 sm:gap-5" style={rise(3)}>
          <ModeCard
            href={loginFor(`/${game}/ranked`)}
            title="წოდებისთვის ბრძოლა"
            text="შემთხვევითი მოთამაშეები, ქულა და წოდება იცვლება"
            accent={current.accent}
            featured
            note={!user && online ? "შესვლა საჭიროა" : rating ? `${rating.rating} ქულა · ${current.name}` : "ახალი, 50 ქულით დაიწყებთ"}
            art={<RankEmblem rank={user ? current : RANKS[0]} className="size-20" />}
          />
          <ModeCard
            href={loginFor(`/${game}/friendly`)}
            title="მეგობრული მატჩი"
            text="შემთხვევითი მოთამაშეები, ქულა არ იცვლება"
            accent="#7dd3fc"
            note={!user && online ? "შესვლა საჭიროა" : undefined}
            art={<IconCards />}
          />
          <ModeCard
            href={loginFor(`/${game}/private`)}
            title="კერძო მაგიდა"
            text="მხოლოდ მეგობრები, შეიყვანეთ კოდით"
            accent="#86efac"
            note={!user && online ? "შესვლა საჭიროა" : undefined}
            art={<IconTable />}
          />
          <ModeCard
            href={`/${game}/bots`}
            title="ბოტებთან"
            text="სავარჯიშო თამაში, არაფერი იწერება"
            accent="#c4b5fd"
            art={<IconBot />}
          />
        </section>
      </div>
    </PageShell>
  );
}

export function ModeCard({
  href,
  title,
  text,
  accent,
  art,
  note,
  featured,
}: {
  href: string;
  title: string;
  text: string;
  accent: string;
  art: React.ReactNode;
  note?: string;
  featured?: boolean;
}) {
  return (
    <Link href={href} className="group block outline-none">
      <div
        className="relative flex min-h-36 items-center gap-3 overflow-hidden rounded-[2rem] border bg-white/[0.04] p-4 transition-[translate,border-color,background-color,box-shadow] duration-300 ease-out group-hover:-translate-y-1.5 group-hover:bg-white/[0.07] group-focus-visible:border-amber-300 sm:min-h-48 sm:flex-col sm:items-start sm:justify-between sm:gap-4 sm:p-6"
        style={{
          borderColor: featured ? `${accent}66` : "rgb(255 255 255 / 0.1)",
          boxShadow: featured ? `0 0 0 1px ${accent}22, 0 18px 50px -24px ${accent}88` : undefined,
        }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: `${accent}33` }}
        />
        <div className="relative grid size-16 flex-none place-items-center transition-transform duration-300 group-hover:scale-110 sm:size-16 [&>*]:size-14 sm:[&>*]:size-16">
          {art}
        </div>
        <div className="relative min-w-0 flex-1">
          <h2 className="text-lg font-extrabold leading-tight min-[360px]:text-xl sm:text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-white/55 sm:mt-1.5">{text}</p>
          {note && (
            <span className="mt-3 inline-block rounded-full px-3 py-1 text-sm font-bold" style={{ background: `${accent}22`, color: accent }}>
              {note}
            </span>
          )}
        </div>
        <span className="relative text-2xl text-white/30 transition-transform duration-300 group-hover:translate-x-1.5 sm:absolute sm:right-5 sm:top-5">
          →
        </span>
      </div>
    </Link>
  );
}

function IconCards() {
  return (
    <svg viewBox="0 0 64 64" className="size-20" fill="none" aria-hidden>
      <g transform="rotate(-14 24 36)">
        <rect x="8" y="12" width="28" height="40" rx="5" fill="#fbf8ef" />
        <path d="M22 24c-4 4-6 6-6 9a3.4 3.4 0 0 0 6 2c-.3 2-1 3.4-2.2 4.2h4.4c-1.2-.8-1.9-2.2-2.2-4.2a3.4 3.4 0 0 0 6-2c0-3-2-5-6-9z" fill="#d6443f" transform="translate(0 -2)" />
      </g>
      <g transform="rotate(12 42 34)">
        <rect x="26" y="12" width="28" height="40" rx="5" fill="#fbf8ef" />
        <path d="M40 28l5.5 9.5-5.5 9.5-5.5-9.5z" fill="#1d1d24" />
      </g>
    </svg>
  );
}

/** Private table: a round table seen from above, four seats around it and a lock in the middle. */
export function IconTable() {
  const c = "#86efac";
  const seats = [
    [32, 5],
    [59, 32],
    [32, 59],
    [5, 32],
  ];
  return (
    <svg viewBox="0 0 64 64" className="size-20" fill="none" aria-hidden>
      {seats.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="4.5" fill={c} opacity="0.55" />
      ))}
      <circle cx="32" cy="32" r="21" fill={c} fillOpacity="0.14" stroke={c} strokeWidth="2.5" />
      <rect x="23.5" y="30" width="17" height="13" rx="3.5" fill={c} />
      <path d="M27 30v-4.5a5 5 0 0 1 10 0V30" stroke={c} strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="36" r="1.8" fill="#0d3a24" />
    </svg>
  );
}

/** Practice against bots: a friendly robot head with a visor and a suit on its forehead. */
export function IconBot() {
  const c = "#c4b5fd";
  return (
    <svg viewBox="0 0 64 64" className="size-20" fill="none" aria-hidden>
      <path d="M32 14V7" stroke={c} strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="6" r="3.5" fill={c} />
      <rect x="4" y="30" width="6" height="12" rx="3" fill={c} opacity="0.6" />
      <rect x="54" y="30" width="6" height="12" rx="3" fill={c} opacity="0.6" />
      <rect x="10" y="14" width="44" height="40" rx="13" fill={c} fillOpacity="0.16" stroke={c} strokeWidth="2.8" />
      <rect x="16" y="28" width="32" height="14" rx="7" fill="#1e1340" />
      <circle cx="25" cy="35" r="3.6" fill={c} />
      <circle cx="39" cy="35" r="3.6" fill={c} />
      <path
        d="M32 17.5c-2 2-3.5 3.2-3.5 5a1.8 1.8 0 0 0 3.2 1c-.1 1-.5 1.6-1.2 2h3c-.7-.4-1.1-1-1.2-2a1.8 1.8 0 0 0 3.2-1c0-1.8-1.5-3-3.5-5z"
        fill={c}
      />
      <path d="M25 48h14" stroke={c} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** The player: portrait, rank with the way to the next one, and the numbers of this game. */
function ProfileCard({
  game,
  rating,
  results,
  position,
  loginHref,
}: {
  game: "joker" | "bura";
  rating: RatingRow | null;
  results: GameResult[] | null;
  position: number | null;
  loginHref: string;
}) {
  const { user, profile } = useAuth();
  const standing = rankFor(rating?.rating ?? 50);

  if (!user) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
        <RankEmblem rank={RANKS[0]} className="size-16" />
        <div>
          <h2 className="text-xl font-extrabold">თქვენი პროფილი</h2>
          <p className="mt-1 text-white/55">შედით, რომ ნახოთ წოდება, ქულები და სტატისტიკა.</p>
        </div>
        <Link href={loginHref} className={`${BTN_PRIMARY} w-fit`}>
          შესვლა
        </Link>
      </div>
    );
  }

  const stats = results ? computeStats(results) : null;
  const cells: [string, string][] = [
    ["თამაში", stats ? String(stats.played) : "…"],
    ["მოგება", stats ? String(stats.wins) : "…"],
    ["მოგების %", stats ? `${stats.winRate}%` : "…"],
    ["საშ. ადგილი", stats?.avgPlace ? stats.avgPlace.toFixed(1) : "—"],
  ];

  return (
    <div className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      <div className="flex items-center gap-4">
        <Avatar size="lg" color={profile?.avatar_color} icon={profile?.avatar_icon} url={profile?.avatar_url} />
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-extrabold">{profile?.nickname ?? "პროფილი"}</h2>
          <Link href="/profile" className="text-sm font-bold text-amber-300 hover:underline">
            სრული პროფილი →
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-2xl bg-black/20 p-4">
        <RankEmblem rank={standing.rank} className="size-16 flex-none" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <b className="text-lg" style={{ color: standing.rank.accent }}>
              {standing.rank.name}
            </b>
            <span className="text-lg font-black tabular-nums">{rating ? rating.rating : "—"}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.round(standing.progress * 100)}%`, background: standing.rank.accent }}
            />
          </div>
          <p className="mt-1.5 text-xs text-white/50">
            {standing.next ? `${standing.next.name}-მდე ${standing.toNext} ქულა` : "უმაღლესი წოდება"}
            {position ? ` · #${position} ლიდერბორდზე` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {cells.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white/[0.05] px-1 py-2">
            <b className="block text-lg font-extrabold tabular-nums">{value}</b>
            <span className="text-[0.65rem] leading-tight text-white/50">{label}</span>
          </div>
        ))}
      </div>
      <p className="-mt-2 text-xs text-white/35">
        {game === "bura" ? "ბურის" : "ჯოკრის"} სტატისტიკა; ბოტებთან თამაში არ ითვლება
      </p>
    </div>
  );
}
