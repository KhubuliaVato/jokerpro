"use client";

import { tt } from "@/lib/i18n";
import { isRed, rankLabel, SUIT_SYMBOL } from "@/lib/joker/cards";
import { locateHand, type GameState, type Play } from "@/lib/joker/engine";
import type { TrickLog } from "@/lib/joker/trickLog";
import { Nick } from "./Nick";
import { usePlayerAvatars, usePlayerNames } from "./names";

const fmt = (n: number) => (n > 0 ? `+${n}` : String(n));

/** A card put on the table, small: "A♠", or the joker with its mode (↑ takes, ↓ gives up) and the suit it named. */
export function CardChip({ play, won }: { play: Play; won?: boolean }) {
  const card = play.card;
  const red = !card.joker && isRed(card.suit);
  return (
    <span
      className={`inline-flex min-w-9 items-center justify-center gap-0.5 rounded-md border px-1.5 py-0.5 text-xs font-extrabold tabular-nums leading-tight ${
        won ? "border-amber-300/70 bg-amber-300/15" : "border-white/10 bg-white/[0.06]"
      } ${red ? "text-red-300" : card.joker ? "text-fuchsia-200" : "text-white/90"}`}
    >
      {card.joker ? (
        <>
          {tt("ჯოკ", "Jkr", "Джок")}
          {play.mode === "high" ? "↑" : "↓"}
          {play.suit ? SUIT_SYMBOL[play.suit] : ""}
        </>
      ) : (
        <>
          {rankLabel(card.rank)}
          {SUIT_SYMBOL[card.suit]}
        </>
      )}
    </span>
  );
}

const trumpLabel = (trump: GameState["history"][number]["trump"]) =>
  trump ? <span className={isRed(trump) ? "text-red-300" : ""}>{SUIT_SYMBOL[trump]}</span> : <span>{tt("კოზირის გარეშე", "no trump", "без козыря")}</span>;

/** Every trick of one hand: who put what and who took it; under it, what each player said and took. */
export function HandTricks({ game, hand, tricks }: { game: GameState; hand: number; tricks: TrickLog[] }) {
  const names = usePlayerNames();
  const h = game.history[hand];
  if (!h) return null;
  const mine = tricks.filter((t) => t.hand === hand).sort((a, b) => a.no - b.no);
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-black/25 p-3 text-left">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
        <span>
          {tt("კოზირი", "Trump", "Козырь")}: <b className="text-sm text-white">{trumpLabel(h.trump)}</b>
        </span>
        {h.bids.map((bid, p) => (
          <span key={p}>
            {names[p]}: <b className={bid === h.taken[p] ? "text-emerald-300" : "text-red-300"}>{bid === 0 ? tt("პასი", "pass", "пас") : bid}/{h.taken[p]}</b>
          </span>
        ))}
      </p>
      {mine.length === 0 ? (
        <p className="text-xs text-white/40">{tt("ამ ხელის სვლები არ ჩაწერილა", "The moves of this hand were not recorded", "Ходы этой раздачи не записаны")}</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {mine.map((t, i) => (
            <li key={t.no} className="flex flex-wrap items-center gap-1.5">
              <span className="w-5 text-xs text-white/40 tabular-nums">{i + 1}.</span>
              {t.plays.map((pl) => (
                <span key={pl.player} className="flex items-center gap-1">
                  <span className={`text-[0.65rem] ${pl.player === t.winner ? "font-bold text-amber-200" : "text-white/40"}`}>{names[pl.player]}</span>
                  <CardChip play={pl} won={pl.player === t.winner} />
                </span>
              ))}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** All the hands of one player: what they said, what they took, the points, and the cards they played in each trick. */
export function PlayerHands({ game, player, tricks }: { game: GameState; player: number; tricks: TrickLog[] }) {
  const names = usePlayerNames();
  const avatars = usePlayerAvatars();
  return (
    <div className="pk-scroll max-h-[45vh] overflow-y-auto rounded-xl bg-black/25 p-3 text-left">
      <p className="mb-2 text-xs font-bold text-white/50">
        <Nick name={names[player]} style={avatars?.[player]?.nick} />: {tt("ყველა ხელი", "all hands", "все раздачи")}
      </p>
      <ul className="flex flex-col gap-2">
        {game.history.map((h, i) => {
          const loc = locateHand(game.rules, i);
          const mine = tricks.filter((t) => t.hand === i).sort((a, b) => a.no - b.no);
          const hit = h.bids[player] === h.taken[player];
          return (
            <li key={i} className="flex flex-col gap-1 border-t border-white/10 pt-2 first:border-t-0 first:pt-0">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                <b className="text-white/70">
                  {loc.pulka + 1}.{loc.inPulka + 1}
                </b>
                <span className="text-white/50">
                  {h.cards} {tt("კარტი", "cards", "карт")} · {trumpLabel(h.trump)}
                </span>
                <span className={hit ? "text-emerald-300" : "text-red-300"}>
                  {tt("თქვა", "said", "заказ")} {h.bids[player] === 0 ? tt("პასი", "pass", "пас") : h.bids[player]} · {tt("აიღო", "took", "взял")} {h.taken[player]}
                </span>
                <b className={`ml-auto tabular-nums ${hit ? "text-emerald-300" : "text-red-300"}`}>{fmt(h.points[player])}</b>
              </p>
              {mine.length > 0 && (
                <p className="flex flex-wrap gap-1">
                  {mine.map((t) => {
                    const pl = t.plays.find((x) => x.player === player);
                    return pl ? <CardChip key={t.no} play={pl} won={t.winner === player} /> : null;
                  })}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
