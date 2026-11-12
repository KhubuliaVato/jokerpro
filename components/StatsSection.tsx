"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { formatDate, formatTime } from "@/lib/format";
import { GAMES, gameName } from "@/lib/games";
import { computeStats, type GameResult } from "@/lib/stats";
import { PLAYER_NAMES } from "./names";
import { loadPosition, loadRating, type RatingRow } from "@/lib/ratings";
import type { PlayerSummary } from "@/lib/search";
import { getSupabase } from "@/lib/supabase";
import { PlaceMedal } from "./PlaceMedal";
import { StatsDashboard } from "./StatsDashboard";
import { PlayerHero } from "./PlayerHero";
import { Inventory } from "./Inventory";
import { AchievementsBoard, nextAchievement, useBoard } from "./AchievementsBoard";
import { GameTabs, Panel } from "./ProfileWidgets";
import { hintOf, titleOf, iconOf } from "@/lib/achievements";
import { FORMAT_LABEL, rise } from "./ui";

/** Colour of a game's row by the place taken (gold, silver, bronze; nothing for the rest). */
const PLACE_TONE: Record<number, string> = { 1: "#fbbf24", 2: "#cbd5e1", 3: "#d08a4c" };

type Tab = "overview" | "stats" | "achievements" | "inventory" | "history";

/**
 * The whole page of a player below the header bar: the hero card with the rank of the chosen game, then tabs
 * (overview, stats, achievements, history). Shared by the own profile and by the page of any other player.
 */
export function StatsSection({
  userId,
  results,
  loadError,
  owner = false,
  name,
  player,
  subtitle,
  actions,
}: {
  /** The player these stats belong to (their rating is loaded for the rank card). */
  userId: string;
  /** Newest first; null while loading. */
  results: GameResult[] | null;
  loadError: string | null;
  /** The viewer's own profile: the empty state invites them to play, scores say "თქვენ". */
  owner?: boolean;
  /** Whose stats these are, used in the score breakdown when it is not the viewer. */
  name?: string;
  player: PlayerSummary | null;
  subtitle?: string;
  /** The player's own controls (menu), shown on the hero card. */
  actions?: React.ReactNode;
}) {
  const t = useT();
  const [gameId, setGameId] = useState(GAMES[0].id);
  const [tab, setTab] = useState<Tab>("overview");
  const [standing, setStanding] = useState<{ userId: string; gameId: string; row: RatingRow | null; position: number | null } | null>(null);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;
    Promise.all([loadRating(supabase, userId, gameId), loadPosition(supabase, userId, gameId)]).then(([row, position]) => {
      if (!cancelled) setStanding({ userId, gameId, row, position });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, gameId]);
  const mine = standing && standing.userId === userId && standing.gameId === gameId ? standing : null;
  const all = results ?? [];
  // Rank, charts, numbers and history show one game at a time.
  const rows = all.filter((r) => r.game === gameId);
  const game = GAMES.find((g) => g.id === gameId) ?? GAMES[0];
  const stats = computeStats(rows);
  const firstName = owner ? PLAYER_NAMES[0] : (name ?? t("მოთამაშე", "Player", "Игрок"));
  const board = useBoard(userId, owner);
  const nextUp = nextAchievement(board);

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: t("მიმოხილვა", "Overview", "Обзор") },
    { id: "stats", label: t("სტატისტიკა", "Stats", "Статистика") },
    { id: "achievements", label: t("მიღწევები", "Achievements", "Достижения") },
    { id: "inventory", label: t("ინვენტარი", "Inventory", "Инвентарь") },
    { id: "history", label: t("ისტორია", "History", "История") },
  ];

  return (
    <>
      <PlayerHero
        player={player}
        subtitle={subtitle}
        rating={mine?.row ?? null}
        position={mine?.position ?? null}
        gameSwitch={<GameTabs games={GAMES} value={gameId} onChange={setGameId} />}
        actions={actions}
        owner={owner}
      />

      <div className="flex flex-col gap-6 pb-8" style={rise(2)}>
        <div role="tablist" className="flex flex-wrap gap-2">
          {TABS.map((x) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => setTab(x.id)}
              className={`rounded-full border px-5 py-2.5 text-base font-bold transition-[color,background-color,border-color] duration-200 ${
                tab === x.id
                  ? "border-amber-300/60 bg-amber-300/15 text-amber-200"
                  : "border-white/10 bg-white/[0.04] text-white/60 hover:border-amber-300/40 hover:text-amber-200"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Tile label={t("თამაში", "Games", "Игры")} value={String(stats.played)} icon="♠" tone="#fcd34d" />
              <Tile label={t("გამარჯვება", "Wins", "Победы")} value={String(stats.wins)} icon="★" tone="#34d399" />
              <Tile label={t("საუკეთესო ქულა", "Best score", "Лучший счёт")} value={stats.best === null ? "—" : String(stats.best)} icon="♦" tone="#7dd3fc" />
              <Tile label={t("საშუალო ადგილი", "Average place", "Среднее место")} value={stats.avgPlace === null ? "—" : stats.avgPlace.toFixed(1)} icon="♥" tone="#fb7185" />
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Panel title={`${t("ბოლო თამაშები", "Latest games", "Последние игры")} · ${game.name}`}>
                {results === null && !loadError ? (
                  <div className="h-24 animate-pulse rounded-2xl bg-white/[0.06]" />
                ) : rows.length === 0 ? (
                  <EmptyGames name={game.name} href={game.href} owner={owner} />
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {rows.slice(0, 3).map((r) => (
                      <HistoryRow key={r.id} r={r} firstName={firstName} />
                    ))}
                  </ul>
                )}
              </Panel>
              {nextUp ? (
                <Panel title={t("შემდეგი მიღწევა", "Next achievement", "Следующее достижение")}>
                  <div className="flex items-center gap-4">
                    <span className="grid size-14 flex-none place-items-center rounded-full bg-white/10 text-3xl">{iconOf(nextUp.def.id)}</span>
                    <div className="min-w-0 flex-1">
                      <b className="block text-lg leading-tight">{titleOf(nextUp.def.id) ? t(...titleOf(nextUp.def.id)!) : nextUp.def.id}</b>
                      <span className="text-sm text-white/45">{t(...hintOf(nextUp.def))}</span>
                      <span className="mt-2.5 block h-2 overflow-hidden rounded-full bg-white/10">
                        <span className="block h-full rounded-full bg-amber-300" style={{ width: `${(nextUp.value / nextUp.def.target) * 100}%` }} />
                      </span>
                      <span className="mt-1 block text-xs tabular-nums text-white/50">
                        {nextUp.value}/{nextUp.def.target}
                      </span>
                    </div>
                  </div>
                </Panel>
              ) : (
                <Panel title={t("მიღწევები", "Achievements", "Достижения")}>
                  <p className="text-white/50">
                    {board
                      ? `${board.earned.length}/${board.defs.length}`
                      : t("იტვირთება…", "Loading…", "Загрузка…")}
                  </p>
                </Panel>
              )}
            </div>
          </>
        )}

        {tab === "stats" && <StatsDashboard rows={rows} userId={userId} gameId={gameId} />}

        {tab === "achievements" && <AchievementsBoard board={board} />}

        {tab === "inventory" && <Inventory userId={userId} owner={owner} avatar={player ? { color: player.avatar_color, icon: player.avatar_icon, url: player.avatar_url } : undefined} nickname={player?.nickname} />}

        {tab === "history" && (
          <section className="flex flex-col gap-4">
            <h2 className="text-2xl font-extrabold">
              {game.name} · {t("ისტორია", "History", "История")}
            </h2>
            {loadError && (
              <p className="text-sm text-red-300">
                {t("ისტორია ვერ ჩაიტვირთა", "Could not load history", "Не удалось загрузить историю")}: {loadError}
              </p>
            )}
            {results === null && !loadError ? (
              <div className="h-24 animate-pulse rounded-2xl bg-white/[0.06]" />
            ) : rows.length === 0 ? (
              <EmptyGames name={game.name} href={game.href} owner={owner} />
            ) : (
              <HistoryList rows={rows.slice(0, 30)} firstName={firstName} />
            )}
          </section>
        )}
      </div>
    </>
  );
}

function EmptyGames({ name, href, owner }: { name: string; href: string; owner: boolean }) {
  const t = useT();
  return (
    <p className="text-lg text-white/45">
      {t(`${name}-ში ჯერ არცერთი თამაში არ დასრულებულა.`, `No ${name} games finished yet.`, `Ни одной игры в ${name} ещё не завершено.`)}{" "}
      {owner && (
        <Link href={href} className="text-amber-300 underline underline-offset-4">
          {t("ითამაშეთ", "Play", "Играть")}
        </Link>
      )}
    </p>
  );
}

function Tile({ label, value, icon, tone }: { label: string; value: string; icon: string; tone: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl border bg-gradient-to-b from-white/[0.08] to-white/[0.02] px-5 py-5 transition-[translate,border-color] duration-200 hover:-translate-y-1"
      style={{ borderColor: `${tone}33` }}
    >
      <div className="pointer-events-none absolute -right-6 -top-8 size-24 rounded-full blur-2xl" style={{ background: `${tone}22` }} />
      <span className="relative grid size-10 place-items-center rounded-full text-xl" style={{ background: `${tone}22`, color: tone }}>
        {icon}
      </span>
      <b className="relative mt-3 block text-4xl font-extrabold tabular-nums sm:text-5xl" style={{ color: tone }}>
        {value}
      </b>
      <span className="relative mt-1 block text-sm text-white/55">{label}</span>
    </div>
  );
}

/** The history of one game: a summary strip, then the games grouped by day. */
function HistoryList({ rows, firstName }: { rows: GameResult[]; firstName: string }) {
  const t = useT();
  const wins = rows.filter((r) => r.place === 1).length;
  const podium = rows.filter((r) => r.place <= 3).length;
  const avg = rows.reduce((sum, r) => sum + r.place, 0) / rows.length;
  const delta = rows.reduce((sum, r) => sum + (r.rating_before != null && r.rating_after != null ? r.rating_after - r.rating_before : 0), 0);
  const hasRating = rows.some((r) => r.rating_before != null && r.rating_after != null);

  const days: { label: string; rows: GameResult[] }[] = [];
  for (const r of rows) {
    const label = formatDate(new Date(r.played_at));
    const last = days[days.length - 1];
    if (last && last.label === label) last.rows.push(r);
    else days.push({ label, rows: [r] });
  }

  const stat = (label: string, value: string, tone: string) => (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] px-4 py-3">
      <span className="block text-xs font-bold uppercase tracking-wider text-white/45">{label}</span>
      <b className="mt-0.5 block text-2xl font-extrabold tabular-nums" style={{ color: tone }}>{value}</b>
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat(t("მოგება", "Wins", "Победы"), `${wins}/${rows.length}`, "#fbbf24")}
        {stat(t("პრიზიორი", "Podium", "Призовые"), String(podium), "#e2e8f0")}
        {stat(t("საშუალო ადგილი", "Avg. place", "Среднее место"), avg.toFixed(1), "#7dd3fc")}
        {stat(t("ქულა", "Rating", "Рейтинг"), hasRating ? `${delta > 0 ? "+" : ""}${delta}` : "—", delta > 0 ? "#6ee7b7" : delta < 0 ? "#fca5a5" : "#94a3b8")}
      </div>

      {days.map((d) => (
        <div key={d.label} className="flex flex-col gap-2.5">
          <h3 className="flex items-center gap-3 pt-2 text-sm font-extrabold uppercase tracking-[0.14em] text-white/45">
            {d.label}
            <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
            <span className="text-xs font-bold normal-case tracking-normal text-white/35">
              {d.rows.length} {t("თამაში", "games", "игр")}
            </span>
          </h3>
          <ul className="flex flex-col gap-2.5">
            {d.rows.map((r) => (
              <HistoryRow key={r.id} r={r} firstName={firstName} timeOnly />
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/** How one player played a finished Joker game (the figures come from `result_stats`). */
interface PlayStats {
  hands: number;
  hits: number;
  khishtis: number;
  best: number;
  streak: number;
}

function HistoryRow({ r, firstName, timeOnly = false }: { r: GameResult; firstName: string; timeOnly?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  // undefined: not asked yet; null: no figures for this game
  const [stats, setStats] = useState<PlayStats[] | null | undefined>(undefined);
  const when = new Date(r.played_at);
  const tone = PLACE_TONE[r.place];
  const delta = r.rating_before != null && r.rating_after != null ? r.rating_after - r.rating_before : null;

  // the figures are asked for the first time the game is opened
  const hasFigures = r.game === "joker" && !!r.online;
  useEffect(() => {
    if (!open || !hasFigures || stats !== undefined) return;
    const supabase = getSupabase();
    if (!supabase) return;
    let off = false;
    supabase.rpc("result_stats", { p_result: r.id }).then(({ data, error }) => {
      if (!off) setStats(!error && Array.isArray(data) ? (data as PlayStats[]) : null);
    });
    return () => {
      off = true;
    };
  }, [open, hasFigures, stats, r.id]);

  // everybody at the table, best first, with their figures
  const standings = r.scores
    .map((s, i) => ({ score: s, me: i === 0, st: stats?.[i], name: r.players?.[i] ?? (i === 0 ? firstName : (PLAYER_NAMES[i] ?? `${t("მოთამაშე", "Player", "Игрок")} ${i + 1}`)) }))
    .sort((a, b) => b.score - a.score);
  const top = standings[0]?.score ?? 0;
  const max = Math.max(1, ...r.scores.map((s) => Math.abs(s)));

  // the best figure of each kind is marked (only when the players differ)
  const marks = (pick: (s: PlayStats) => number, better: "high" | "low") => {
    const values = standings.flatMap((p) => (p.st ? [pick(p.st)] : []));
    if (values.length < 2 || Math.min(...values) === Math.max(...values)) return null;
    return better === "high" ? Math.max(...values) : Math.min(...values);
  };
  const bestHits = marks((s) => s.hits, "high");
  const bestKh = marks((s) => s.khishtis, "low");
  const bestHand = marks((s) => s.best, "high");
  const bestStreak = marks((s) => s.streak, "high");

  const cell = (label: string, value: string, hot: boolean) => (
    <div className={`rounded-lg px-2.5 py-1.5 ${hot ? "bg-amber-300/12 ring-1 ring-amber-300/40" : "bg-white/[0.04]"}`}>
      <span className="block text-[0.62rem] font-extrabold uppercase leading-tight tracking-wider text-white/40">{label}</span>
      <b className={`text-base font-extrabold tabular-nums ${hot ? "text-amber-300" : "text-white/90"}`}>{value}</b>
    </div>
  );

  return (
    <li
      className="relative overflow-hidden rounded-2xl border transition-[border-color,background-color] duration-200 hover:border-white/25"
      style={{ borderColor: tone ? `${tone}38` : "rgb(255 255 255 / 0.1)", background: tone ? `linear-gradient(90deg, ${tone}1c, rgb(255 255 255 / 0.025) 45%)` : "rgb(255 255 255 / 0.03)" }}
    >
      {tone && <span className="absolute inset-y-0 left-0 w-1" style={{ background: `linear-gradient(180deg, ${tone}, ${tone}55)` }} />}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left sm:gap-5">
        <PlaceMedal place={r.place} size={3.2} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-extrabold leading-tight">
            {gameName(r.game)} <span className="font-bold text-white/55">· {FORMAT_LABEL[r.format] ?? r.format}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-white/45">
            <span className="tabular-nums">{timeOnly ? formatTime(when) : `${formatDate(when)} · ${formatTime(when)}`}</span>
            {r.kind && (
              <span className={`rounded-full px-2.5 py-0.5 text-[0.68rem] font-extrabold uppercase tracking-wider ${r.kind === "ranked" ? "bg-amber-300/15 text-amber-300" : "bg-sky-300/15 text-sky-300"}`}>
                {r.kind === "ranked" ? t("წოდებისთვის", "Ranked", "Рейтинговая") : t("მეგობრული", "Friendly", "Дружеская")}
              </span>
            )}
          </span>
        </span>
        {delta != null && (
          <span
            className={`hidden flex-none items-center gap-1 rounded-full px-3 py-1 text-sm font-extrabold tabular-nums sm:inline-flex ${delta > 0 ? "bg-emerald-400/12 text-emerald-300" : delta < 0 ? "bg-red-400/12 text-red-300" : "bg-white/8 text-white/50"}`}
            title={t("ქულის ცვლილება", "Rating change", "Изменение очков")}
          >
            <span aria-hidden className="text-[0.65rem]">{delta > 0 ? "▲" : delta < 0 ? "▼" : "–"}</span>
            {Math.abs(delta)}
          </span>
        )}
        <span className="flex-none text-right">
          <b className={`block text-2xl font-extrabold leading-none tabular-nums ${r.score < 0 ? "text-red-300" : "text-white"}`}>{r.score}</b>
          {delta != null && (
            <span className={`mt-1 block text-xs font-bold tabular-nums sm:hidden ${delta > 0 ? "text-emerald-300" : delta < 0 ? "text-red-300" : "text-white/45"}`}>
              {delta > 0 ? "▲" : delta < 0 ? "▼" : ""} {Math.abs(delta)}
            </span>
          )}
        </span>
        <svg viewBox="0 0 24 24" className={`size-5 flex-none text-white/35 transition-transform duration-300 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <ul className="flex flex-col gap-3 border-t border-white/10 px-4 py-4">
            {standings.map((p, i) => (
              <li key={i} className={`flex flex-col gap-2.5 rounded-2xl p-3 ${p.me ? "bg-amber-300/[0.06] ring-1 ring-amber-300/20" : "bg-white/[0.025]"}`}>
                <div className="flex items-center gap-3 text-sm">
                  <PlaceMedal place={p.me ? r.place : i + 1} size={1.9} />
                  <span className={`w-24 flex-none truncate text-base sm:w-36 ${p.me ? "font-extrabold text-amber-300" : "font-bold text-white/75"}`}>{p.name}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <span
                      className={`block h-full rounded-full ${p.score < 0 ? "bg-red-400/70" : p.me ? "bg-gradient-to-r from-amber-500 to-amber-300" : "bg-white/40"}`}
                      style={{ width: `${(Math.abs(p.score) / max) * 100}%` }}
                    />
                  </span>
                  <b className="w-12 flex-none text-right text-base tabular-nums">{p.score}</b>
                  <span className="hidden w-12 flex-none text-right text-xs tabular-nums text-white/35 sm:block">{i === 0 ? "" : p.score - top}</span>
                </div>
                {p.st && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {cell(t("ნათქვამი წაიღო", "Kept the bid", "Выполнил заказ"), `${p.st.hits}/${p.st.hands}`, bestHits === p.st.hits)}
                    {cell(t("ხიშტი", "Khishtis", "Хишти"), String(p.st.khishtis), bestKh === p.st.khishtis)}
                    {cell(t("საუკეთესო ხელი", "Best hand", "Лучшая раздача"), `+${p.st.best}`, bestHand === p.st.best)}
                    {cell(t("სტრიკი", "Best run", "Серия"), String(p.st.streak), bestStreak === p.st.streak)}
                  </div>
                )}
              </li>
            ))}
            {open && hasFigures && stats === undefined && <li className="h-10 animate-pulse rounded-xl bg-white/[0.05]" />}
          </ul>
        </div>
      </div>
    </li>
  );
}
