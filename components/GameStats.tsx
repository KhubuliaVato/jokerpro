"use client";

import { tt } from "@/lib/i18n";
import type { GameState } from "@/lib/joker/engine";
import { gameStats, type PlayerStats } from "@/lib/joker/stats";
import type { TrickLog } from "@/lib/joker/trickLog";
import { Nick } from "./Nick";
import { usePlayerAvatars, usePlayerNames } from "./names";

const fmt = (n: number) => (n > 0 ? `+${n}` : String(n));

interface Row {
  label: string;
  /** What is written in a player's cell. */
  show: (s: PlayerStats) => string;
  /** The number the players are compared by, and which way is better; no `better` means nobody is marked. */
  rank: (s: PlayerStats) => number;
  better?: "high" | "low";
}

/** The statistics of the game, one column per player; the best value of a line is marked in gold. */
export function GameStats({ game, tricks }: { game: GameState; tricks: TrickLog[] }) {
  const names = usePlayerNames();
  const avatars = usePlayerAvatars();
  const stats = gameStats(game, tricks);

  const rows: Row[] = [
    { label: tt("რამდენ ხელში წაიღო თავისი", "Hands where they took what they said", "Сколько раз взял свой заказ"), show: (s) => `${s.hits}/${s.hands}`, rank: (s) => s.hits, better: "high" },
    { label: tt("რამდენჯერ გაიხიშტა", "Times they got a khishti", "Сколько раз хишти"), show: (s) => String(s.khishtis), rank: (s) => s.khishtis, better: "low" },
    { label: tt("რამდენი ქულა დაკარგა ხიშტებში", "Points lost on khishtis", "Очков потеряно на хишти"), show: (s) => (s.khishtiPoints === 0 ? "—" : fmt(s.khishtiPoints)), rank: (s) => s.khishtiPoints, better: "high" },
    { label: tt("რამდენი პასი ჰქონდა წარმატებული", "Successful passes", "Удачных пасов"), show: (s) => `${s.passesKept}/${s.passes}`, rank: (s) => s.passesKept, better: "high" },
    { label: tt("რამდენჯერ ვერ წაიღო ნათქვამი", "Times they took less than said", "Сколько раз взял меньше заказа"), show: (s) => String(s.fewer), rank: (s) => s.fewer, better: "low" },
    { label: tt("რამდენჯერ შეეტენა", "Times they took more than said", "Сколько раз «набил» больше заказа"), show: (s) => String(s.more), rank: (s) => s.more, better: "low" },
    { label: tt("რამდენჯერ წაიღო ყველა ხელი (მაგ. 9-დან 9)", "Times they took every trick of the hand", "Сколько раз взял все взятки"), show: (s) => String(s.allIn), rank: (s) => s.allIn, better: "high" },
    { label: tt("მაქსიმალური წაღებული ქულა", "Best hand (points)", "Лучший результат за раздачу"), show: (s) => fmt(s.best), rank: (s) => s.best, better: "high" },
    { label: tt("ყველაზე დაბალი წაღებული ქულა", "Worst hand (points)", "Худший результат за раздачу"), show: (s) => fmt(s.worst), rank: (s) => s.worst, better: "high" },
    { label: tt("წარმატებულად წაღებული ხელების სტრიკი", "Longest run of kept bids", "Серия выполненных заказов"), show: (s) => String(s.streak), rank: (s) => s.streak, better: "high" },
    { label: tt("რამდენჯერ აიღო პრემია", "Round bonuses won", "Сколько раз взял премию"), show: (s) => (s.premiums === 0 ? "—" : `${s.premiums} · ${fmt(s.premiumPoints)}`), rank: (s) => s.premiumPoints, better: "high" },
  ];
  if (stats[0].jokers) {
    rows.push(
      { label: tt("რამდენჯერ დადო ჯოკერი: მაღალი / დაბალი", "Jokers played: high / low", "Джокеров сыграно: высокий / низкий"), show: (s) => `${s.jokers?.high ?? 0} / ${s.jokers?.low ?? 0}`, rank: (s) => (s.jokers?.high ?? 0) + (s.jokers?.low ?? 0) },
      { label: tt("რამდენი აღება აიღო ჯოკერით", "Tricks won with a joker", "Взяток джокером"), show: (s) => String(s.jokers?.won ?? 0), rank: (s) => s.jokers?.won ?? 0, better: "high" },
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/25 p-2">
      <table className="w-full min-w-[20rem] text-center text-xs tabular-nums">
        <thead>
          <tr>
            <th className="px-2 py-1.5" />
            {names.map((n, p) => (
              <th key={p} className="px-1.5 py-1.5 text-sm font-extrabold">
                <Nick name={n} style={avatars?.[p]?.nick} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const values = stats.map(row.rank);
            const top = row.better === "high" ? Math.max(...values) : row.better === "low" ? Math.min(...values) : null;
            const allSame = values.every((v) => v === values[0]);
            return (
              <tr key={row.label} className="border-t border-white/10">
                <td className="px-2 py-1.5 text-left text-white/60">{row.label}</td>
                {stats.map((s, p) => (
                  <td key={p} className={`px-1.5 py-1.5 font-bold ${top !== null && !allSame && values[p] === top ? "text-amber-300" : ""}`}>
                    {row.show(s)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-2 pb-1 pt-2 text-left text-[0.7rem] leading-snug text-white/40">
        {tt(
          "„წაიღო თავისი“ ნიშნავს, რომ რამდენსაც ამბობდა, ზუსტად იმდენი აიღო. „შეეტენა“ ნიშნავს, რომ ნათქვამზე მეტი აიღო. „ყველა ხელი“ არის, როცა თქვა მთელი კარტი (მაგ. 9) და ყველა აიღო. პრემია ეძლევა, თუ ეტაპის ყველა ხელში წაიღო თავისი.",
          "“Took what they said” means exactly the number of tricks they bid. A bonus goes to a player who made every bid of a round.",
          "«Взял свой» значит, что взял ровно столько взяток, сколько заказал. Премия — тому, кто выполнил все заказы этапа.",
        )}
      </p>
    </div>
  );
}
