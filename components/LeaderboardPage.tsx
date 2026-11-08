"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useT } from "@/lib/i18n";
import { GAMES } from "@/lib/games";
import { rankFor } from "@/lib/ranks";
import { loadLeaderboard, loadPosition, type LeaderRow } from "@/lib/ratings";
import { getSupabase } from "@/lib/supabase";
import { Nick } from "./Nick";
import { Avatar } from "./Avatar";
import { CityBoard } from "./CityBoard";
import { PageShell } from "./PageShell";
import { RankEmblem } from "./RankEmblem";
import { INPUT, rise } from "./ui";

const MEDAL = ["#fcd34d", "#cbd5e1", "#fb923c"];
/** Each game has its own colour (the same as on the main menu): the active tab and the glow of the page. */
const ACCENT: Record<string, string> = { joker: "#fbbf24", bura: "#34d399" };

const winRateOf = (r: Pick<LeaderRow, "games" | "wins">) => (r.games > 0 ? Math.round((r.wins / r.games) * 100) : 0);

function Crown({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 32 20" className="absolute -top-6 left-1/2 z-10 w-9 -translate-x-1/2 drop-shadow-[0_2px_6px_rgb(0_0_0/0.4)]" aria-hidden>
      <path d="M2 17 L5 4 L12 11 L16 2 L20 11 L27 4 L30 17 Z" fill={color} stroke="rgb(0 0 0 / 0.25)" strokeWidth="1" strokeLinejoin="round" />
      <rect x="3" y="17" width="26" height="2.5" rx="1" fill={color} />
    </svg>
  );
}

/** The best players of a game, top three on a podium, then the list. */
export function LeaderboardPage() {
  const { user, configured } = useAuth();
  const t = useT();
  const [gameId, setGameId] = useState(GAMES[0].id);
  const [showCities, setShowCities] = useState(false);
  const [board, setBoard] = useState<{ gameId: string; rows: LeaderRow[]; error: string | null } | null>(null);
  const [query, setQuery] = useState("");
  const [mine, setMine] = useState<{ userId: string; gameId: string; position: number | null } | null>(null);

  const userId = user?.id ?? null;
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;
    loadLeaderboard(supabase, gameId, 100).then(({ rows, error }) => {
      if (!cancelled) setBoard({ gameId, rows, error });
    });
    return () => {
      cancelled = true;
    };
  }, [gameId]);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    loadPosition(supabase, userId, gameId).then((position) => {
      if (!cancelled) setMine({ userId, gameId, position });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, gameId]);

  const current = board && board.gameId === gameId ? board : null;
  const rows = current?.rows ?? [];
  const searching = query.trim() !== "";
  const found = searching ? rows.filter((r) => r.nickname.toLowerCase().includes(query.trim().toLowerCase())) : [];
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const accent = showCities ? "#38bdf8" : (ACCENT[gameId] ?? "#fbbf24");
  const myRow = rows.find((r) => r.user_id === userId) ?? null;
  const myPosition = mine && mine.userId === userId && mine.gameId === gameId ? mine.position : null;

  return (
    <PageShell width="max-w-4xl" glow={accent}>
      <section className="flex flex-col gap-4" style={rise(1)}>
        <h1 className="text-[clamp(1.6rem,8.5vw,3rem)] font-extrabold tracking-tight sm:text-7xl">{t("ლიდერბორდი", "Leaderboard", "Рейтинг")}</h1>
        <div className="flex flex-wrap gap-2">
          {GAMES.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                setGameId(g.id);
                setShowCities(false);
              }}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-base font-bold transition-colors ${
                !showCities && g.id === gameId ? "text-black" : "border border-white/15 text-white/60 hover:text-white"
              }`}
              style={!showCities && g.id === gameId ? { background: ACCENT[g.id] ?? "#fbbf24" } : undefined}
            >
              <span>{g.icon}</span>
              {g.name}
            </button>
          ))}
          <button
            onClick={() => setShowCities(true)}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-base font-bold transition-colors ${showCities ? "text-black" : "border border-white/15 text-white/60 hover:text-white"}`}
            style={showCities ? { background: "#38bdf8" } : undefined}
          >
            <span>🏙</span>
            {t("ქალაქები", "Cities", "Города")}
          </button>
        </div>
        {configured && !showCities && rows.length > 3 && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("მოძებნეთ მოთამაშე სახელით", "Find a player by name", "Найти игрока по имени")}
            className={`${INPUT} max-w-sm`}
          />
        )}
      </section>

      {showCities && configured ? (
        <CityBoard />
      ) : !configured ? (
        <p className="text-white/55">{t("ლიდერბორდი ჯერ არ არის ჩართული.", "The leaderboard is not enabled yet.", "Рейтинг пока не включён.")}</p>
      ) : !current ? (
        <div className="h-64 animate-pulse rounded-3xl bg-white/[0.06]" />
      ) : current.error ? (
        <p className="text-red-300">{t("ვერ ჩაიტვირთა", "Could not load", "Не удалось загрузить")}: {current.error}</p>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/20 px-6 py-14 text-center" style={rise(2)}>
          <p className="text-xl text-white/60">{t("ჯერ არავის დაუსრულებია რეიტინგული თამაში.", "Nobody has finished a ranked game yet.", "Пока никто не завершил рейтинговую игру.")}</p>
          <p className="mt-2 text-white/40">{t("იყავით პირველი, ითამაშეთ ‹წოდებისთვის ბრძოლა›.", "Be the first: play a ranked game.", "Будьте первым: сыграйте в рейтинговую игру.")}</p>
          <Link href={`/${gameId}/ranked`} className="mt-6 inline-block rounded-full bg-amber-300 px-7 py-3 text-lg font-extrabold text-black">
            {t("თამაში", "Play", "Играть")}
          </Link>
        </div>
      ) : searching ? (
        <ul className="flex flex-col gap-2" style={rise(2)}>
          {found.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-white/20 px-6 py-10 text-center text-white/55">
              {t("ამ სახელით მოთამაშე ტოპ 100-ში ვერ მოიძებნა", "Nobody with this name in the top 100", "В топ-100 нет игрока с таким именем")}
            </li>
          ) : (
            found.map((r) => <Row key={r.user_id} r={r} me={r.user_id === userId} />)
          )}
        </ul>
      ) : (
        <>
          <section className="grid grid-cols-3 items-end gap-3 sm:gap-6" style={rise(2)}>
            {[1, 0, 2].map((i) => {
              const p = podium[i];
              if (!p) return <div key={i} />;
              const standing = rankFor(p.rating);
              const first = i === 0;
              // Tied players share the medal of their position.
              const medal = MEDAL[Math.min(p.pos - 1, 2)];
              return (
                <Link
                  key={p.user_id}
                  href={p.user_id === userId ? "/profile" : `/players/${p.user_id}`}
                  className="group flex flex-col items-center gap-1.5 text-center"
                >
                  <div className="relative">
                    {p.pos === 1 && <Crown color={medal} />}
                    <div
                      className={`rounded-full p-1 ${first ? "max-sm:[&_.avatar-face]:size-20! max-sm:[&_.avatar-face]:text-4xl!" : "max-sm:[&_.avatar-face]:size-14! max-sm:[&_.avatar-face]:text-2xl!"}`}
                      style={{ background: `linear-gradient(160deg, ${medal}, ${medal}55)`, boxShadow: first ? `0 0 40px -6px ${medal}aa` : undefined }}
                    >
                      <Avatar
                        size={first ? "xl" : "lg"}
                        color={p.avatar_color}
                        icon={p.avatar_icon}
                        url={p.avatar_url}
                      />
                    </div>
                    <span
                      className="absolute -bottom-2 left-1/2 grid size-6 -translate-x-1/2 place-items-center rounded-full text-sm sm:size-8 sm:text-base font-black text-black"
                      style={{ background: medal }}
                    >
                      {p.pos}
                    </span>
                  </div>
                  <b className="mt-3 max-w-full truncate text-base font-extrabold sm:text-lg group-hover:text-amber-300 sm:text-xl">
                    <Nick name={p.nickname} style={p.equipped_name} />
                  </b>
                  <RankEmblem rank={standing.rank} className={first ? "size-14 sm:size-16" : "size-10 sm:size-12"} />
                  <span className="text-xs font-bold sm:text-sm" style={{ color: standing.rank.accent }}>
                    {standing.rank.name}
                  </span>
                  <span className="text-2xl font-black tabular-nums sm:text-3xl" style={{ color: standing.rank.accent }}>
                    {p.rating}
                  </span>
                  <span className="text-xs text-white/50 sm:text-sm">
                    {p.games} {t("თამაში", "games", "игр")} · {winRateOf(p)}%
                  </span>
                  <div
                    className="mt-1 w-full rounded-t-2xl border-x border-t"
                    style={{
                      height: first ? "7rem" : i === 1 ? "5rem" : "3.6rem",
                      borderColor: `${medal}55`,
                      background: `linear-gradient(180deg, ${medal}66, ${medal}11 70%, transparent)`,
                      boxShadow: `0 -10px 30px -12px ${medal}88`,
                    }}
                  />
                </Link>
              );
            })}
          </section>

          {rest.length > 0 && (
            <ul className="flex flex-col gap-2" style={rise(3)}>
              {rest.map((r) => (
                <Row key={r.user_id} r={r} me={r.user_id === userId} />
              ))}
            </ul>
          )}

          {userId && myPosition !== null && (
            <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-amber-300/40 bg-[#1a0a10]/95 px-5 py-3 shadow-lg backdrop-blur">
              <Link href="/profile" className="flex items-center gap-3">
                <span className="font-bold text-amber-300">{t("თქვენი ადგილი", "Your place", "Ваше место")}</span>
                <b className="text-2xl tabular-nums">#{myPosition}</b>
                {myRow && <span className="text-white/55 tabular-nums">· {myRow.rating}</span>}
              </Link>
              {myRow && myRow.pos > 3 && (
                <button
                  type="button"
                  onClick={() => document.getElementById("leader-me")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  className="rounded-full border border-amber-300/50 px-4 py-1.5 text-sm font-bold text-amber-300 transition-colors hover:bg-amber-300/10"
                >
                  {t("ჩემს ადგილზე ↓", "Jump to me ↓", "К моему месту ↓")}
                </button>
              )}
            </div>
          )}
          <div className="pb-8" />
        </>
      )}
    </PageShell>
  );
}

function Row({ r, me }: { r: LeaderRow; me: boolean }) {
  const t = useT();
  const standing = rankFor(r.rating);
  const winRate = winRateOf(r);
  return (
    <li id={me ? "leader-me" : undefined}>
      <Link
        href={me ? "/profile" : `/players/${r.user_id}`}
        className={`flex items-center gap-4 rounded-2xl border px-4 py-3 transition-[border-color,background-color,translate] duration-200 hover:-translate-y-0.5 hover:border-white/30 ${
          me ? "border-amber-300/50 bg-amber-300/10" : "border-white/10 bg-white/[0.03]"
        }`}
      >
        <b className="w-10 text-center text-lg tabular-nums text-white/50">{r.pos}</b>
        <Avatar size="md" color={r.avatar_color} icon={r.avatar_icon} url={r.avatar_url} frame={r.equipped_frame} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-bold">
            <Nick name={r.nickname} style={r.equipped_name} />
            {me && <span className="ml-2 text-sm font-semibold text-amber-300">{t("თქვენ", "You", "Вы")}</span>}
          </span>
          <span className="block text-sm text-white/45">
            {r.games} {t("თამაში", "games", "игр")} · {winRate}% {t("გამარჯვება", "wins", "побед")}
          </span>
        </span>
        <span className="hidden items-center gap-2 sm:flex">
          <RankEmblem rank={standing.rank} className="size-9" glow={false} compact />
          <span className="text-sm font-bold" style={{ color: standing.rank.accent }}>
            {standing.rank.name}
          </span>
        </span>
        <b className="w-16 text-right text-2xl tabular-nums">{r.rating}</b>
      </Link>
    </li>
  );
}
