"use client";

import { useEffect, useState } from "react";
import { loadTableGrants, type CoinGrant } from "@/lib/coins";
import { useT } from "@/lib/i18n";
import { rankFor } from "@/lib/ranks";
import { getSupabase } from "@/lib/supabase";
import { CoinIcon, grantLabel } from "./Coins";
import { RankEmblem } from "./RankEmblem";

interface Result {
  place: number;
  before: number | null;
  after: number | null;
}

interface Standing {
  /** Place on the leaderboard before and after this game. */
  was: number;
  now: number;
}

/**
 * What an online game gave the player, once the server has written the result: the change of rating with the way to
 * the next rank, the place on the leaderboard, the coins and achievements, and a winning streak.
 * The server writes the result a moment after the last move, so this asks a few times.
 */
export function OnlineResult({ tableId, userId, game, ranked }: { tableId: string; userId: string; game: "joker" | "bura" | "poker"; ranked: boolean }) {
  const t = useT();
  const [result, setResult] = useState<Result | null>(null);
  const [grants, setGrants] = useState<CoinGrant[]>([]);
  const [streak, setStreak] = useState(0);
  const [standing, setStanding] = useState<Standing | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;

    const finish = async (row: Result) => {
      const [paid, recent] = await Promise.all([
        loadTableGrants(supabase, tableId, userId),
        supabase.from("game_results").select("place, table_id").eq("user_id", userId).eq("online", true).order("played_at", { ascending: false }).limit(15),
      ]);
      if (cancelled) return;
      setGrants(paid);
      const rows = (recent.data ?? []) as { place: number; table_id: string | null }[];
      let wins = 0;
      if (rows[0]?.table_id === tableId) while (wins < rows.length && rows[wins].place === 1) wins++;
      setStreak(wins);
      setResult(row);

      if (ranked && row.before !== null && row.after !== null) {
        const above = (rating: number) =>
          supabase.from("player_ratings").select("user_id", { count: "exact", head: true }).eq("game", game).gt("rating", rating).neq("user_id", userId);
        const [a, b] = await Promise.all([above(row.before), above(row.after)]);
        if (!cancelled && a.count !== null && b.count !== null) setStanding({ was: a.count + 1, now: b.count + 1 });
      }
    };

    const look = async () => {
      const { data } = await supabase.from("game_results").select("place, rating_before, rating_after").eq("table_id", tableId).eq("user_id", userId).maybeSingle();
      if (cancelled) return;
      if (data) void finish({ place: data.place, before: data.rating_before, after: data.rating_after });
      else if (++tries < 15) timer = setTimeout(look, 1000);
    };
    timer = setTimeout(look, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tableId, userId, game, ranked]);

  if (!result) return <span className="text-sm text-white/50">{t("შედეგი ითვლება…", "Calculating the result…", "Считаем результат…")}</span>;

  const coins = grants.filter((g) => g.reason !== "achievement");
  const achievements = grants.filter((g) => g.reason === "achievement");
  const total = grants.reduce((a, g) => a + g.amount, 0);

  const rated = ranked && result.before !== null && result.after !== null;
  const delta = rated ? (result.after as number) - (result.before as number) : 0;
  const now = rated ? rankFor(result.after as number) : null;
  const was = rated ? rankFor(result.before as number).rank : null;
  const moved = !!(now && was && was.index !== now.rank.index);
  const up = !!(now && was && now.rank.index > was.index);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      {now && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <RankEmblem rank={now.rank} className="size-14 flex-none" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <b className={`text-3xl font-black tabular-nums ${delta > 0 ? "text-emerald-300" : delta < 0 ? "text-red-300" : "text-white/70"}`}>{delta > 0 ? `+${delta}` : delta}</b>
                <span className="text-sm text-white/55">{t("რეიტინგი", "rating", "рейтинг")}</span>
              </div>
              <span className="text-sm text-white/60">
                {result.after} {t("ქულა", "points", "очков")} · {now.rank.name}
              </span>
            </div>
            {standing && (
              <div className="flex-none text-right">
                <b className="block text-xl font-extrabold tabular-nums">#{standing.now}</b>
                <span className={`text-xs font-bold ${standing.now < standing.was ? "text-emerald-300" : standing.now > standing.was ? "text-red-300" : "text-white/45"}`}>
                  {standing.now < standing.was ? `▲ ${standing.was - standing.now}` : standing.now > standing.was ? `▼ ${standing.now - standing.was}` : t("იგივე", "same", "так же")}
                </span>
              </div>
            )}
          </div>
          {now.next ? (
            <div className="flex flex-col gap-1">
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.round(now.progress * 100)}%`, background: now.rank.accent }} />
              </div>
              <span className="text-xs text-white/50">
                {t(`${now.next.name}-მდე კიდევ ${now.toNext} ქულა`, `${now.toNext} points to ${now.next.name}`, `До ${now.next.name} ещё ${now.toNext}`)}
              </span>
            </div>
          ) : null}
          {moved && (
            <b className={`text-sm ${up ? "text-amber-300" : "text-red-300"}`}>
              {up ? t(`ახალი წოდება: ${now.rank.name} ★`, `New rank: ${now.rank.name} ★`, `Новый ранг: ${now.rank.name} ★`) : t(`წოდება დაგეკარგათ: ახლა ${now.rank.name}`, `Rank lost: now ${now.rank.name}`, `Ранг потерян: теперь ${now.rank.name}`)}
            </b>
          )}
        </div>
      )}

      {total > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <b className="flex items-center gap-1.5 text-xl font-extrabold tabular-nums text-amber-300">
            <CoinIcon className="size-6" />+{total}
          </b>
          <span className="text-sm text-white/60">
            {coins.map((g) => `${grantLabel(g, t)} +${g.amount}`).join(" · ")}
          </span>
        </div>
      )}

      {achievements.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {achievements.map((g) => (
            <li key={g.ref} className="flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-sm">
              <span aria-hidden>★</span>
              <span className="flex-1 font-bold">
                {t("ახალი მიღწევა", "New achievement", "Новое достижение")}: {grantLabel(g, t)}
              </span>
              <b className="tabular-nums text-amber-200">+{g.amount}</b>
            </li>
          ))}
        </ul>
      )}

      {streak >= 2 && (
        <span className="text-sm font-bold text-amber-200">
          {t(`${streak} გამარჯვება ზედიზედ`, `${streak} wins in a row`, `${streak} победы подряд`)}
        </span>
      )}
    </div>
  );
}
