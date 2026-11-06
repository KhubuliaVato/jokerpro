import { useState } from "react";
import { useT } from "@/lib/i18n";
import { SUIT_SYMBOL } from "@/lib/joker/cards";
import { locateHand, PLAYERS, totals, type GameState } from "@/lib/joker/engine";
import type { TrickLog } from "@/lib/joker/trickLog";
import { usePlayerNames } from "./names";
import { HandTricks } from "./TrickDetail";

const fmt = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Hand-by-hand score table: made bids in green, missed or overtaken ones in red. Tap a hand to see its tricks. */
export function ScoreSheet({ game, className = "", tricks = [] }: { game: GameState; className?: string; tricks?: TrickLog[] }) {
  const t = useT();
  const [open, setOpen] = useState<number | null>(null);
  const names = usePlayerNames();
  const { history, premiums, rules } = game;
  const rows: React.ReactNode[] = [];
  let pulkaSum = Array(PLAYERS).fill(0) as number[];

  history.forEach((h, i) => {
    const { inPulka, pulkaLength } = locateHand(rules, i);
    pulkaSum = pulkaSum.map((v, p) => v + h.points[p]);
    rows.push(
      <tr
        key={`h${i}`}
        onClick={() => setOpen((o) => (o === i ? null : i))}
        aria-expanded={open === i}
        className={`cursor-pointer border-t border-white/10 transition-colors hover:bg-white/[0.04] ${open === i ? "bg-white/[0.05]" : ""}`}
      >
        <td className="px-2 py-1 text-left text-xs whitespace-nowrap opacity-80">
          <span className="font-bold">{h.cards}</span>
          {h.trump ? (
            <span className={`ml-1 text-sm ${h.trump === "D" || h.trump === "H" ? "text-red-400" : ""}`}>
              {SUIT_SYMBOL[h.trump]}
            </span>
          ) : (
            <span className="ml-1.5 text-xs">{t("კოზირის გარეშე", "No trump", "Без козыря")}</span>
          )}
        </td>
        {h.points.map((pt, p) => {
          const made = h.bids[p] === h.taken[p];
          return (
            <td key={p} className="px-1 py-0.5">
              <div
                className={`rounded-md border px-1.5 py-0.5 leading-none ${
                  made
                    ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                    : "border-red-400/50 bg-red-500/20 text-red-200"
                }`}
              >
                <div className="text-[0.6rem] opacity-70">
                  {h.bids[p] === 0 ? t("პასი", "Pass", "Пас") : h.bids[p]} / {h.taken[p]}
                </div>
                <div className="text-sm font-extrabold leading-tight">{fmt(pt)}</div>
              </div>
            </td>
          );
        })}
      </tr>,
    );
    if (open === i) {
      rows.push(
        <tr key={`d${i}`}>
          <td colSpan={PLAYERS + 1} className="px-1 pb-2 pt-0.5">
            <HandTricks game={game} hand={i} tricks={tricks} />
          </td>
        </tr>,
      );
    }
    if (inPulka === pulkaLength - 1) {
      const bonus = premiums[h.pulka];
      const sum = pulkaSum.map((v, p) => v + bonus[p]);
      rows.push(
        <tr key={`p${h.pulka}`} className="border-y border-amber-300/50 bg-amber-300/10">
          <td className="px-2 py-1 text-left text-xs font-bold text-amber-200 whitespace-nowrap">
            {t("ეტაპი", "Round", "Этап")} {h.pulka + 1}
          </td>
          {sum.map((v, p) => (
            <td key={p} className="px-1.5 py-1">
              {bonus[p] > 0 && (
                <div className="text-[0.6rem] font-bold text-emerald-300">{t("პრემია", "Bonus", "Премия")} {fmt(bonus[p])}</div>
              )}
              <div className="text-sm font-extrabold text-amber-200">{v}</div>
            </td>
          ))}
        </tr>,
      );
      pulkaSum = Array(PLAYERS).fill(0);
    }
  });

  const sums = totals(game);
  const top = Math.max(...sums);
  return (
    <div className={`pk-scroll overflow-auto rounded-xl [scrollbar-gutter:stable] ${className}`}>
      <table className="w-full min-w-[20rem] text-center tabular-nums">
        <thead className="sticky top-0 z-10 bg-[var(--bg-b)]">
          <tr>
            <th className="px-2 py-1.5 text-left text-[0.65rem] font-normal opacity-70">{t("ხელი", "Hand", "Раздача")}</th>
            {names.map((n) => (
              <th key={n} className="px-1.5 py-1.5 text-sm">
                {n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
        <tfoot className="sticky bottom-0 bg-[var(--bg-b)]">
          <tr className="border-t-2 border-amber-300/70">
            <td className="px-2 py-2 text-left text-xs font-bold">{t("სულ", "Total", "Итого")}</td>
            {sums.map((v, p) => (
              <td
                key={p}
                className={`px-1.5 py-2 text-lg font-extrabold ${v === top && history.length > 0 ? "text-amber-300" : ""}`}
              >
                {v}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      {history.length === 0 && (
        <p className="py-6 text-center opacity-60">{t("ქულები პირველი ხელის შემდეგ გამოჩნდება", "Scores appear after the first hand", "Очки появятся после первой раздачи")}</p>
      )}
    </div>
  );
}
