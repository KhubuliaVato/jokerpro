"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { formatDate, formatTime } from "@/lib/format";
import { GAMES, gameName } from "@/lib/games";
import { achievements, computeStats, placeCounts, type GameResult } from "@/lib/stats";
import { PLAYER_NAMES } from "./names";
import { loadPosition, loadRating, type RatingRow } from "@/lib/ratings";
import type { PlayerSummary } from "@/lib/search";
import { getSupabase } from "@/lib/supabase";
import { PlayerHero } from "./PlayerHero";
import { Inventory } from "./Inventory";
import { Achievements, Donut, GameTabs, Panel, PlaceBars, Sparkline } from "./ProfileWidgets";
import { FORMAT_LABEL, rise } from "./ui";

const PLACE_STYLE = [
  "",
  "bg-amber-300 text-black",
  "bg-slate-300 text-black",
  "bg-orange-400 text-black",
  "border border-white/25 text-white/80",
];

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
  const trend = rows
    .slice(0, 12)
    .map((r) => r.score)
    .reverse();
  const firstName = owner ? PLAYER_NAMES[0] : (name ?? t("მოთამაშე", "Player", "Игрок"));
  const items = gameId === "joker" ? achievements(rows) : [];
  const nextUp = items
    .filter((a) => !a.done)
    .sort((a, b) => b.progress.value / b.progress.max - a.progress.value / a.progress.max)[0];

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
                    <span className="grid size-14 flex-none place-items-center rounded-full bg-white/10 text-3xl text-white/50">{nextUp.icon}</span>
                    <div className="min-w-0 flex-1">
                      <b className="block text-lg leading-tight">{nextUp.title}</b>
                      <span className="text-sm text-white/45">{nextUp.hint}</span>
                      <span className="mt-2.5 block h-2 overflow-hidden rounded-full bg-white/10">
                        <span className="block h-full rounded-full bg-amber-300" style={{ width: `${(nextUp.progress.value / nextUp.progress.max) * 100}%` }} />
                      </span>
                      <span className="mt-1 block text-xs tabular-nums text-white/50">
                        {nextUp.progress.value}/{nextUp.progress.max}
                      </span>
                    </div>
                  </div>
                </Panel>
              ) : (
                <Panel title={t("მიღწევები", "Achievements", "Достижения")}>
                  <p className="text-white/50">
                    {items.length
                      ? t("ყველა მიღწევა აღებულია", "Every achievement is unlocked", "Все достижения получены")
                      : t("ამ თამაშისთვის მიღწევები ჯერ არ არის.", "No achievements for this game yet.", "Для этой игры достижений пока нет.")}
                  </p>
                </Panel>
              )}
            </div>
          </>
        )}

        {tab === "stats" && (
          <div className="grid gap-6 md:grid-cols-2">
            <Panel title={t("გამარჯვებები", "Wins", "Победы")}>
              <div className="flex items-center gap-6">
                <Donut percent={stats.winRate} label={t("წარმატება", "Success", "Успех")} />
                <PlaceBars counts={placeCounts(rows)} />
              </div>
            </Panel>
            <Panel title={t("ბოლო თამაშების ქულა", "Recent scores", "Очки последних игр")}>
              <Sparkline values={trend} />
            </Panel>
          </div>
        )}

        {tab === "achievements" &&
          (items.length ? (
            <Achievements items={items} />
          ) : (
            <Panel>
              <p className="text-white/50">{t("ამ თამაშისთვის მიღწევები ჯერ არ არის.", "No achievements for this game yet.", "Для этой игры достижений пока нет.")}</p>
            </Panel>
          ))}

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
              <ul className="flex flex-col gap-2.5">
                {rows.slice(0, 30).map((r) => (
                  <HistoryRow key={r.id} r={r} firstName={firstName} />
                ))}
              </ul>
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

function HistoryRow({ r, firstName }: { r: GameResult; firstName: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const when = new Date(r.played_at);
  const max = Math.max(1, ...r.scores.map((s) => Math.abs(s)));
  return (
    <li className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-colors hover:border-white/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-4 py-3.5 text-left"
      >
        <span
          className={`grid size-11 flex-none place-items-center rounded-full text-lg font-extrabold ${PLACE_STYLE[r.place] ?? PLACE_STYLE[4]}`}
          title={t(`${r.place} ადგილი`, `Place ${r.place}`, `${r.place} место`)}
        >
          {r.place}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-bold">
            {gameName(r.game)} · {FORMAT_LABEL[r.format] ?? r.format}
            {r.kind && (
              <span
                className={`ml-2 rounded-full px-2.5 py-0.5 align-middle text-xs font-bold ${
                  r.kind === "ranked" ? "bg-amber-300/15 text-amber-300" : "bg-sky-300/15 text-sky-300"
                }`}
              >
                {r.kind === "ranked" ? t("წოდებისთვის", "Ranked", "Рейтинговая") : t("მეგობრული", "Friendly", "Дружеская")}
              </span>
            )}
          </span>
          <span className="block text-sm text-white/45">
            {formatDate(when)} · {formatTime(when)}
          </span>
        </span>
        {r.rating_before != null && r.rating_after != null && (
          <b
            className={`w-14 text-right text-lg tabular-nums ${
              r.rating_after > r.rating_before ? "text-emerald-300" : r.rating_after < r.rating_before ? "text-red-300" : "text-white/50"
            }`}
            title={t("ქულის ცვლილება", "Rating change", "Изменение очков")}
          >
            {r.rating_after - r.rating_before > 0 ? "+" : ""}
            {r.rating_after - r.rating_before}
          </b>
        )}
        <b className={`text-2xl tabular-nums ${r.score < 0 ? "text-red-300" : "text-white"}`}>{r.score}</b>
        <span className={`text-white/35 transition-transform duration-300 ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>

      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <ul className="flex flex-col gap-2.5 border-t border-white/10 px-4 py-4">
            {r.scores.map((s, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className={`w-24 flex-none truncate ${i === 0 ? "font-bold text-amber-300" : "text-white/60"}`}>
                  {r.players?.[i] ?? (i === 0 ? firstName : (PLAYER_NAMES[i] ?? `${t("მოთამაშე", "Player", "Игрок")} ${i + 1}`))}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span
                    className={`block h-full rounded-full ${s < 0 ? "bg-red-400/70" : i === 0 ? "bg-amber-300" : "bg-white/40"}`}
                    style={{ width: `${(Math.abs(s) / max) * 100}%` }}
                  />
                </span>
                <b className="w-12 flex-none text-right tabular-nums">{s}</b>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}
