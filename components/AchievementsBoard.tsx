"use client";

import { useEffect, useState } from "react";
import { PROFILE_CHANGED } from "@/lib/auth/AuthProvider";
import { type AchievementDef, type Board, type Group, GROUPS, groupOf, hintOf, iconOf, loadBoard, titleOf } from "@/lib/achievements";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";
import { CoinIcon } from "./Coins";

const GROUP_COLOR: Record<Group, string> = {
  games: "#fbbf24",
  wins: "#34d399",
  online: "#38bdf8",
  ranks: "#f472b6",
  levels: "#a78bfa",
  collection: "#fb923c",
  social: "#f87171",
};

/** The achievements of a player: null while loading. For one's own page the database pays what is due first. */
export function useBoard(userId: string, owner: boolean): Board | null {
  const [state, setState] = useState<{ key: string; board: Board } | null>(null);
  const key = `${userId}:${owner}`;
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let off = false;
    loadBoard(supabase, userId, owner).then((board) => {
      if (off || !board) return;
      setState({ key, board });
      // coins and XP may have been paid just now
      if (board.fresh.length > 0) window.dispatchEvent(new Event(PROFILE_CHANGED));
    });
    return () => {
      off = true;
    };
  }, [userId, owner, key]);
  return state && state.key === key ? state.board : null;
}

/** How far a player is toward an achievement, 0..1 (null when it is not known: another player's page). */
export function progressOf(d: AchievementDef, board: Board): number | null {
  if (!board.metrics) return null;
  return Math.min(1, Math.max(0, (board.metrics[d.metric] ?? 0) / d.target));
}

/** The locked achievement the player is closest to. */
export function nextAchievement(board: Board | null): { def: AchievementDef; value: number } | null {
  if (!board || !board.metrics) return null;
  const done = new Set(board.earned.map((e) => e.id));
  let best: { def: AchievementDef; value: number; ratio: number } | null = null;
  for (const d of board.defs) {
    if (done.has(d.id)) continue;
    const value = Math.min(board.metrics[d.metric] ?? 0, d.target);
    const ratio = value / d.target;
    if (!best || ratio > best.ratio) best = { def: d, value, ratio };
  }
  return best;
}

export function AchievementsBoard({ board }: { board: Board | null }) {
  const t = useT();
  const [group, setGroup] = useState<Group | "all">("all");

  if (!board) return <div className="h-48 animate-pulse rounded-3xl bg-white/[0.06]" />;

  const earned = new Map(board.earned.map((e) => [e.id, e.at]));
  const total = board.defs.length;
  const done = board.defs.filter((d) => earned.has(d.id)).length;
  const coins = board.defs.filter((d) => earned.has(d.id)).reduce((s, d) => s + d.coins, 0);
  const xp = board.defs.filter((d) => earned.has(d.id)).reduce((s, d) => s + d.xp, 0);
  const shown = board.defs.filter((d) => group === "all" || groupOf(d.id) === group);

  return (
    <section className="flex flex-col gap-5">
      <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/[0.09] to-white/[0.02] p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold">{t("მიღწევები", "Achievements", "Достижения")}</h2>
            <p className="mt-1 text-sm text-white/50">{t("თითოეული მონეტას და XP-ს გაძლევთ, ბევრი ლეველსაც ამაღლებს", "Each one pays coins and XP, and many raise your level", "Каждое даёт монеты и XP, а многие повышают уровень")}</p>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right">
              <b className="block text-3xl font-black tabular-nums leading-none text-amber-300">
                {done}
                <span className="text-lg font-bold text-white/40">/{total}</span>
              </b>
              <span className="text-xs text-white/45">{t("მიღებულია", "unlocked", "получено")}</span>
            </div>
            <div className="hidden text-right text-sm sm:block">
              <span className="flex items-center justify-end gap-1 font-extrabold tabular-nums text-amber-200">
                <CoinIcon className="size-4" />
                {coins}
              </span>
              <span className="font-extrabold tabular-nums text-indigo-300">{xp} XP</span>
            </div>
          </div>
        </div>
        <div className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-[width] duration-700" style={{ width: `${(done / Math.max(1, total)) * 100}%` }} />
        </div>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label={t("კატეგორიები", "Categories", "Категории")}>
        {([["all", [`ყველა`, "All", "Все"]], ...GROUPS.map((g) => [g.id, g.label] as const)] as [Group | "all", [string, string, string]][]).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setGroup(id)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-extrabold transition-colors ${group === id ? "border-amber-300 bg-amber-300 text-black" : "border-white/15 text-white/70 hover:border-white/40 hover:text-white"}`}
          >
            {t(...label)}
          </button>
        ))}
      </nav>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((d) => {
          const at = earned.get(d.id);
          const color = GROUP_COLOR[groupOf(d.id)];
          const p = progressOf(d, board);
          const name = titleOf(d.id);
          return (
            <li
              key={d.id}
              className={`relative flex gap-4 overflow-hidden rounded-2xl border p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 ${at ? "" : "border-white/10 bg-white/[0.025]"}`}
              style={at ? { borderColor: `${color}66`, background: `linear-gradient(135deg, ${color}1f, rgb(255 255 255 / 0.03) 60%)`, boxShadow: `0 16px 36px -24px ${color}` } : undefined}
            >
              <span
                className={`grid size-14 flex-none place-items-center rounded-full text-2xl ${at ? "text-black" : "text-white/35 grayscale"}`}
                style={at ? { background: `radial-gradient(circle at 32% 25%, #fff, ${color} 60%)`, boxShadow: `0 0 0 3px ${color}55, 0 0 22px -4px ${color}` } : { background: "rgb(255 255 255 / 0.06)", boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.1)" }}
              >
                {iconOf(d.id)}
              </span>
              <div className="min-w-0 flex-1">
                <b className={`block text-base font-extrabold leading-tight ${at ? "" : "text-white/75"}`}>{name ? t(...name) : d.id}</b>
                <span className="mt-0.5 block text-xs leading-snug text-white/50">{t(...hintOf(d))}</span>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums ${at ? "bg-amber-300/20 text-amber-200" : "bg-white/[0.06] text-white/55"}`}>
                    <CoinIcon className="size-3.5" />+{d.coins}
                  </span>
                  {d.xp > 0 && <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums ${at ? "bg-indigo-300/20 text-indigo-200" : "bg-white/[0.06] text-white/55"}`}>+{d.xp} XP</span>}
                  {at && <span className="ml-auto text-[0.7rem] text-white/40">✓ {formatDate(new Date(at))}</span>}
                </div>
                {!at && p !== null && (
                  <div className="mt-2.5">
                    <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${p * 100}%`, background: color }} />
                    </span>
                    <span className="mt-1 block text-[0.7rem] tabular-nums text-white/45">
                      {Math.min(board.metrics?.[d.metric] ?? 0, d.target)}/{d.target}
                    </span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
