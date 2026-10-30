import { count, other, pips, turnPlans, type NardiState, type Player, type Step } from "./engine";

/** How a bot plays. `mistake` is the chance of playing a random legal turn instead of the best one. */
export interface NardiStyle {
  mistake: number;
}

export const STRONG_NARDI: NardiStyle = { mistake: 0 };

/** How good a position is for player p once a turn has been played (higher is better). */
export function evaluate(s: NardiState, p: Player): number {
  const q = other(p);
  if (s.winner === p) return 1e6;
  if (s.winner === q) return -1e6;
  // the race counts hits too: a hit checker is back on 25
  let score = (pips(s, q) - pips(s, p)) * 1.0;
  let run = 0;
  for (let r = 1; r <= 25; r++) {
    const n = r <= 24 ? count(s, p, r) : 0;
    if (n >= 2) {
      score += 1.2 + (r <= 6 ? 0.9 : 0);
      run++;
    } else {
      if (run >= 2) score += run * run * 0.5; // a wall of made points
      run = 0;
    }
    if (n === 1) {
      // a lone checker can be hit: weigh the opponent checkers that are 1..12 pips behind it
      let shots = 0;
      for (let o = 1; o <= 24; o++) {
        const c = count(s, q, o);
        if (!c) continue;
        // the opponent's own number of the point where our blot stands
        const blotForOpp = 25 - r;
        const d = o - blotForOpp;
        if (d >= 1 && d <= 6) shots += c * 0.17;
        else if (d >= 7 && d <= 12) shots += c * 0.05;
      }
      if (s.bar[q] > 0 && 25 - (25 - r) <= 6) shots += 0.3 * s.bar[q];
      score -= Math.min(1, shots) * (25 - r) * 0.9;
    }
  }
  score -= s.bar[p] * 4;
  score += s.bar[q] * 4;
  score += (s.off[p] - s.off[q]) * 1.5;
  return score;
}

/** The steps the bot plays this turn, in order. */
export function botTurn(s: NardiState, style: NardiStyle = STRONG_NARDI, rng: () => number = Math.random): Step[] {
  const plans = turnPlans(s);
  if (plans.length === 0) return [];
  if (rng() < style.mistake) return plans[Math.floor(rng() * plans.length)].steps;
  const p = s.turn;
  let best = plans[0];
  let bestScore = -Infinity;
  for (const plan of plans) {
    const score = evaluate(plan.end, p) + rng() * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = plan;
    }
  }
  return best.steps;
}
