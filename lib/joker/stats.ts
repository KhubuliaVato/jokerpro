import type { GameState } from "./engine";
import { PLAYERS } from "./engine";
import type { TrickLog } from "./trickLog";

/** What one player did over a whole game, counted from the score sheet (and, when they were seen, the tricks). */
export interface PlayerStats {
  hands: number;
  /** Bids that came true. */
  hits: number;
  /** A bid of one or more and not a single trick: the penalty hand. */
  khishtis: number;
  /** Points lost on those hands. */
  khishtiPoints: number;
  /** Passes (a bid of 0) and how many of them were kept. */
  passes: number;
  passesKept: number;
  /** Hands where the player took fewer tricks than said / more than said. */
  fewer: number;
  more: number;
  /** Hands where the bid was every card of the hand and it came true. */
  allIn: number;
  tricks: number;
  best: number;
  worst: number;
  /** The most bids that came true in a row. */
  streak: number;
  /** Rounds (pulkas) where every hand was made, and the bonus points they brought. */
  premiums: number;
  premiumPoints: number;
  /** Seen tricks only: jokers put down (high / low) and tricks taken with a joker; null when no trick was seen. */
  jokers: { high: number; low: number; won: number } | null;
}

export function gameStats(game: GameState, tricks: TrickLog[] = []): PlayerStats[] {
  return Array.from({ length: PLAYERS }, (_, p) => {
    let streak = 0;
    let run = 0;
    const s: PlayerStats = {
      hands: game.history.length,
      hits: 0,
      khishtis: 0,
      khishtiPoints: 0,
      passes: 0,
      passesKept: 0,
      fewer: 0,
      more: 0,
      allIn: 0,
      tricks: 0,
      best: 0,
      worst: 0,
      streak: 0,
      premiums: 0,
      premiumPoints: 0,
      jokers: null,
    };
    game.history.forEach((h, i) => {
      const bid = h.bids[p] ?? 0;
      const taken = h.taken[p];
      const points = h.points[p];
      const hit = bid === taken;
      s.tricks += taken;
      s.best = i === 0 ? points : Math.max(s.best, points);
      s.worst = i === 0 ? points : Math.min(s.worst, points);
      if (hit) {
        s.hits++;
        run++;
        streak = Math.max(streak, run);
        if (bid > 0 && bid === h.cards) s.allIn++;
      } else {
        run = 0;
        if (taken < bid) s.fewer++;
        else s.more++;
      }
      if (bid === 0) {
        s.passes++;
        if (hit) s.passesKept++;
      } else if (taken === 0) {
        s.khishtis++;
        s.khishtiPoints += points;
      }
    });
    s.streak = streak;
    game.premiums.forEach((row) => {
      if (row[p] > 0) {
        s.premiums++;
        s.premiumPoints += row[p];
      }
    });
    if (tricks.length > 0) {
      const jokers = { high: 0, low: 0, won: 0 };
      for (const t of tricks) {
        const play = t.plays.find((x) => x.player === p);
        if (play?.card.joker) {
          if (play.mode === "high") jokers.high++;
          else jokers.low++;
          if (t.winner === p) jokers.won++;
        }
      }
      s.jokers = jokers;
    }
    return s;
  });
}
