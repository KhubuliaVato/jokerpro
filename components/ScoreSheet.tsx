import { SUIT_SYMBOL } from "@/lib/joker/cards";
import { locateHand, PLAYERS, totals, type GameState } from "@/lib/joker/engine";
import { usePlayerNames } from "./names";

const fmt = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Hand-by-hand score table: made bids in green, missed or overtaken ones in red. */
export function ScoreSheet({ game }: { game: GameState }) {
  const names = usePlayerNames();
  const { history, premiums, rules } = game;
  const rows: React.ReactNode[] = [];
  let pulkaSum = Array(PLAYERS).fill(0) as number[];

  history.forEach((h, i) => {
    const { inPulka, pulkaLength } = locateHand(rules, i);
    pulkaSum = pulkaSum.map((v, p) => v + h.points[p]);
    rows.push(
      <tr key={`h${i}`} className="border-t border-white/10">
        <td className="px-3 py-2 text-left text-sm whitespace-nowrap opacity-80">
          <span className="font-bold">{h.cards}</span>
          {h.trump ? (
            <span className={`ml-1.5 text-base ${h.trump === "D" || h.trump === "H" ? "text-red-400" : ""}`}>
              {SUIT_SYMBOL[h.trump]}
            </span>
          ) : (
            <span className="ml-1.5 text-xs">კოზირის გარეშე</span>
          )}
        </td>
        {h.points.map((pt, p) => {
          const made = h.bids[p] === h.taken[p];
          return (
            <td key={p} className="px-1.5 py-1.5">
              <div
                className={`rounded-lg border px-2 py-1 ${
                  made
                    ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                    : "border-red-400/50 bg-red-500/20 text-red-200"
                }`}
              >
                <div className="text-xs opacity-80">
                  {h.bids[p] === 0 ? "პასი" : h.bids[p]} / {h.taken[p]}
                </div>
                <div className="text-lg font-extrabold leading-tight">{fmt(pt)}</div>
              </div>
            </td>
          );
        })}
      </tr>,
    );
    if (inPulka === pulkaLength - 1) {
      const bonus = premiums[h.pulka];
      const sum = pulkaSum.map((v, p) => v + bonus[p]);
      rows.push(
        <tr key={`p${h.pulka}`} className="border-y border-amber-300/50 bg-amber-300/10">
          <td className="px-3 py-2 text-left text-sm font-bold text-amber-200 whitespace-nowrap">
            ეტაპი {h.pulka + 1}
          </td>
          {sum.map((v, p) => (
            <td key={p} className="px-2 py-2">
              {bonus[p] > 0 && (
                <div className="text-xs font-bold text-emerald-300">პრემია {fmt(bonus[p])}</div>
              )}
              <div className="text-lg font-extrabold text-amber-200">{v}</div>
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
    <div className="max-h-[68vh] overflow-auto rounded-xl">
      <table className="w-full min-w-[22rem] text-center tabular-nums">
        <thead className="sticky top-0 z-10 bg-[#0c2a1b]">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-normal opacity-70">ხელი</th>
            {names.map((n) => (
              <th key={n} className="px-2 py-2.5 text-base">
                {n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
        <tfoot className="sticky bottom-0 bg-[#0c2a1b]">
          <tr className="border-t-2 border-amber-300/70">
            <td className="px-3 py-3 text-left text-sm font-bold">სულ</td>
            {sums.map((v, p) => (
              <td
                key={p}
                className={`px-2 py-3 text-2xl font-extrabold ${v === top && history.length > 0 ? "text-amber-300" : ""}`}
              >
                {v}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      {history.length === 0 && (
        <p className="py-6 text-center opacity-60">ქულები პირველი ხელის შემდეგ გამოჩნდება</p>
      )}
    </div>
  );
}
