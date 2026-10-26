"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate, formatTime } from "@/lib/format";
import { GAMES, gameName } from "@/lib/games";
import { achievements, computeStats, placeCounts, type GameResult } from "@/lib/stats";
import { PLAYER_NAMES } from "./names";
import { Achievements, Donut, GameTabs, Panel, PlaceBars, RankCard, Sparkline } from "./ProfileWidgets";
import { FORMAT_LABEL, rise } from "./ui";

const PLACE_STYLE = [
  "",
  "bg-amber-300 text-black",
  "bg-slate-300 text-black",
  "bg-orange-400 text-black",
  "border border-white/25 text-white/80",
];

/**
 * Rank, per-game numbers, charts, achievements and history of one player.
 * Shared by the own profile and by the page of any other player.
 */
export function StatsSection({
  results,
  loadError,
  owner = false,
  name,
}: {
  /** Newest first; null while loading. */
  results: GameResult[] | null;
  loadError: string | null;
  /** The viewer's own profile: the empty state invites them to play, scores say "თქვენ". */
  owner?: boolean;
  /** Whose stats these are, used in the score breakdown when it is not the viewer. */
  name?: string;
}) {
  const [gameId, setGameId] = useState(GAMES[0].id);
  const all = results ?? [];
  // Charts, numbers and history show one game at a time; the rank counts every game.
  const rows = all.filter((r) => r.game === gameId);
  const game = GAMES.find((g) => g.id === gameId) ?? GAMES[0];
  const stats = computeStats(rows);
  const trend = rows
    .slice(0, 12)
    .map((r) => r.score)
    .reverse();

  return (
    <>
      <div className="flex flex-col gap-6" style={rise(2)}>
        <RankCard played={all.length} />

        <GameTabs games={GAMES} value={gameId} onChange={setGameId} />

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Tile label="თამაში" value={String(stats.played)} icon="♠" />
          <Tile label="გამარჯვება" value={String(stats.wins)} icon="★" />
          <Tile label="საუკეთესო ქულა" value={stats.best === null ? "—" : String(stats.best)} icon="♦" />
          <Tile label="საშუალო ადგილი" value={stats.avgPlace === null ? "—" : stats.avgPlace.toFixed(1)} icon="♥" />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Panel title="გამარჯვებები">
            <div className="flex items-center gap-6">
              <Donut percent={stats.winRate} label="წარმატება" />
              <PlaceBars counts={placeCounts(rows)} />
            </div>
          </Panel>
          <Panel title="ბოლო თამაშების ქულა">
            <Sparkline values={trend} />
          </Panel>
        </div>

        {gameId === "joker" && <Achievements items={achievements(rows)} />}
      </div>

      <section className="flex flex-col gap-4 pb-8" style={rise(3)}>
        <h2 className="text-2xl font-extrabold">{game.name} · ისტორია</h2>
        {loadError && <p className="text-sm text-red-300">ისტორია ვერ ჩაიტვირთა: {loadError}</p>}
        {results === null && !loadError ? (
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.06]" />
        ) : rows.length === 0 ? (
          <p className="text-lg text-white/45">
            {game.name}-ში ჯერ არცერთი თამაში არ დასრულებულა.{" "}
            {owner && (
              <Link href={game.href} className="text-amber-300 underline underline-offset-4">
                ითამაშეთ
              </Link>
            )}
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {rows.slice(0, 30).map((r) => (
              <HistoryRow key={r.id} r={r} firstName={owner ? PLAYER_NAMES[0] : (name ?? "მოთამაშე")} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Tile({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-6 transition-[border-color,background-color] duration-200 hover:border-white/25 hover:bg-white/[0.07]">
      <span className="pointer-events-none absolute -right-2 -top-3 text-7xl text-white/[0.05]">{icon}</span>
      <b className="relative block text-4xl font-extrabold tabular-nums text-amber-300 sm:text-5xl">{value}</b>
      <span className="relative mt-1 block text-sm text-white/50">{label}</span>
    </div>
  );
}

function HistoryRow({ r, firstName }: { r: GameResult; firstName: string }) {
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
          title={`${r.place} ადგილი`}
        >
          {r.place}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-bold">
            {gameName(r.game)} · {FORMAT_LABEL[r.format] ?? r.format}
            {r.online && (
              <span className="ml-2 rounded-full bg-emerald-400/15 px-2.5 py-0.5 align-middle text-xs font-bold text-emerald-300">
                ონლაინ
              </span>
            )}
          </span>
          <span className="block text-sm text-white/45">
            {formatDate(when)} · {formatTime(when)}
          </span>
        </span>
        <b className={`text-2xl tabular-nums ${r.score < 0 ? "text-red-300" : "text-white"}`}>{r.score}</b>
        <span className={`text-white/35 transition-transform duration-300 ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <ul className="flex flex-col gap-2.5 border-t border-white/10 px-4 py-4">
            {r.scores.map((s, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className={`w-24 flex-none truncate ${i === 0 ? "font-bold text-amber-300" : "text-white/60"}`}>
                  {r.players?.[i] ?? (i === 0 ? firstName : (PLAYER_NAMES[i] ?? `მოთამაშე ${i + 1}`))}
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
