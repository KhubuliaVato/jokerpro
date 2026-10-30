/**
 * Regular nardi (backgammon, "short" nardi). Pure rules, no React; the dice come from the caller.
 *
 * Each player is described in their own coordinates, "rel" 1..24: the home board is 1..6, the
 * start 24, and a checker always moves to a lower number (or off the board from the home board).
 * A checker on the bar is "point 25": it re-enters on the opponent's home board at 25 - die.
 * `points` is the absolute board: 24 slots, positive counts for player 0 (white), negative for
 * player 1 (black). White's rel r is slot r-1, black's rel r is slot 24-r, so the two sides
 * run in opposite directions round the same board.
 */

export type Player = 0 | 1;

export const CHECKERS = 15;
/** A checker on the bar moves "from" this point. */
export const BAR = 25;

export interface NardiState {
  /** Absolute board, 24 slots: + white checkers, − black checkers. */
  points: number[];
  /** Hit checkers waiting to re-enter. */
  bar: [number, number];
  /** Checkers borne off. */
  off: [number, number];
  turn: Player;
  /** Dice still to play this turn (four values after a double). */
  dice: number[];
  /** The dice as rolled this turn, for showing them; empty before the first roll. */
  rolled: number[];
  /** The player whose last roll had no move at all (the turn passed by itself), else null. */
  passed: Player | null;
  winner: Player | null;
}

/** One checker move. `from` is BAR for re-entry, `to` is 0 when the checker leaves the board. */
export interface Step {
  from: number;
  to: number;
  die: number;
}

export const other = (p: Player): Player => (p === 0 ? 1 : 0);

/** Slot of the absolute board for a player's own point. */
const slot = (p: Player, rel: number): number => (p === 0 ? rel - 1 : 24 - rel);

/** How many checkers the player has on one of their own points (BAR = the bar). */
export function count(s: NardiState, p: Player, rel: number): number {
  if (rel === BAR) return s.bar[p];
  const v = s.points[slot(p, rel)];
  return p === 0 ? Math.max(v, 0) : Math.max(-v, 0);
}

export function newGame(first: Player = 0): NardiState {
  const points = new Array<number>(24).fill(0);
  for (const [rel, n] of [[24, 2], [13, 5], [8, 3], [6, 5]] as const) {
    points[slot(0, rel)] += n;
    points[slot(1, rel)] -= n;
  }
  return { points, bar: [0, 0], off: [0, 0], turn: first, dice: [], rolled: [], passed: null, winner: null };
}

export const needsRoll = (s: NardiState): boolean => s.winner === null && s.dice.length === 0;

/** Two dice, rolled with the given random source (defaults to Math.random). */
export function rollDice(rng: () => number = Math.random): [number, number] {
  return [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];
}

export const pips = (s: NardiState, p: Player): number => {
  let n = BAR * s.bar[p];
  for (let r = 1; r <= 24; r++) n += r * count(s, p, r);
  return n;
};

const allHome = (s: NardiState, p: Player): boolean => {
  if (s.bar[p] > 0) return false;
  for (let r = 7; r <= 24; r++) if (count(s, p, r) > 0) return false;
  return true;
};

/** How many of the opponent's checkers hold the slot of player p's own point `rel`. */
const opponentsAt = (s: NardiState, p: Player, rel: number): number => {
  const v = s.points[slot(p, rel)];
  return p === 0 ? Math.max(-v, 0) : Math.max(v, 0);
};

function applyStep(s: NardiState, st: Step): NardiState {
  const p = s.turn;
  const q = other(p);
  const sign = p === 0 ? 1 : -1;
  const points = s.points.slice();
  const bar: [number, number] = [s.bar[0], s.bar[1]];
  const off: [number, number] = [s.off[0], s.off[1]];
  if (st.from === BAR) bar[p]--;
  else points[slot(p, st.from)] -= sign;
  if (st.to > 0) {
    const i = slot(p, st.to);
    if (opponentsAt(s, p, st.to) === 1) {
      points[i] = 0; // a lone opponent checker is hit
      bar[q]++;
    }
    points[i] += sign;
  } else off[p]++;
  const dice = s.dice.slice();
  dice.splice(dice.indexOf(st.die), 1);
  return { ...s, points, bar, off, dice };
}

/** Every single move allowed by the placement rules, before the "play as many dice as you can" rule. */
function rawSteps(s: NardiState): Step[] {
  const p = s.turn;
  const out: Step[] = [];
  const open = (rel: number) => opponentsAt(s, p, rel) < 2;
  if (s.bar[p] > 0) {
    for (const die of new Set(s.dice)) if (open(BAR - die)) out.push({ from: BAR, to: BAR - die, die });
    return out;
  }
  const home = allHome(s, p);
  let top = 0;
  for (let r = 24; r >= 1; r--) if (count(s, p, r) > 0) { top = r; break; }
  for (const die of new Set(s.dice)) {
    for (let r = 1; r <= 24; r++) {
      if (count(s, p, r) === 0) continue;
      const to = r - die;
      if (to >= 1) {
        if (open(to)) out.push({ from: r, to, die });
      } else if (home && (to === 0 || r === top)) {
        out.push({ from: r, to: 0, die });
      }
    }
  }
  return out;
}

const keyOf = (s: NardiState): string => `${s.points.join(",")}|${s.bar.join("")}|${s.off.join(",")}|${[...s.dice].sort().join("")}`;

function depth(s: NardiState, memo: Map<string, number>): number {
  if (s.dice.length === 0) return 0;
  const key = keyOf(s);
  const known = memo.get(key);
  if (known !== undefined) return known;
  let best = 0;
  for (const st of rawSteps(s)) best = Math.max(best, 1 + depth(applyStep(s, st), memo));
  memo.set(key, best);
  return best;
}

/** The moves the current player may make now: only those that keep the most dice playable. */
export function legalSteps(s: NardiState): Step[] {
  if (s.winner !== null || s.dice.length === 0) return [];
  const memo = new Map<string, number>();
  const best = depth(s, memo);
  if (best === 0) return [];
  let steps = rawSteps(s).filter((st) => 1 + depth(applyStep(s, st), memo) === best);
  // Only one die can be played: it has to be the larger one when that is possible.
  if (best === 1 && s.dice.length === 2 && s.dice[0] !== s.dice[1]) {
    const big = Math.max(...s.dice);
    if (steps.some((st) => st.die === big)) steps = steps.filter((st) => st.die === big);
  }
  return steps;
}

function endTurn(s: NardiState): NardiState {
  return { ...s, turn: other(s.turn), dice: [] };
}

/** Notices a win, and hands the turn over when the roll has no move at all. */
function settle(s: NardiState): NardiState {
  if (s.off[s.turn] === CHECKERS) return { ...s, winner: s.turn, dice: [] };
  return legalSteps(s).length === 0 ? { ...endTurn(s), passed: s.turn } : s;
}

/** Roll for the current player. A roll with no possible move passes the turn at once. */
export function roll(s: NardiState, dice: [number, number] = rollDice()): NardiState {
  if (!needsRoll(s)) return s;
  const list = dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : [dice[0], dice[1]];
  return settle({ ...s, dice: list, rolled: [dice[0], dice[1]], passed: null });
}

/** Plays one move. Throws if it is not legal. */
export function step(s: NardiState, st: Step): NardiState {
  const ok = legalSteps(s).find((x) => x.from === st.from && x.to === st.to && x.die === st.die);
  if (!ok) throw new Error("illegal move");
  const next = applyStep(s, ok);
  if (next.off[s.turn] === CHECKERS) return { ...next, winner: s.turn, dice: [] };
  return next.dice.length === 0 || legalSteps(next).length === 0 ? endTurn(next) : next;
}

/**
 * A win is worth 1 point; 2 (mars) when the loser has borne off nothing; 3 (kox) when they also
 * still have a checker on the bar or in the winner's home board.
 */
export function winPoints(s: NardiState): number {
  if (s.winner === null) return 0;
  const loser = other(s.winner);
  if (s.off[loser] > 0) return 1;
  let stuck = s.bar[loser] > 0;
  for (let r = 19; r <= 24; r++) if (count(s, loser, r) > 0) stuck = true;
  return stuck ? 3 : 2;
}

/** Every distinct way to play out the rest of this turn, each as the list of steps. */
export function turnPlans(s: NardiState): { steps: Step[]; end: NardiState }[] {
  const plans: { steps: Step[]; end: NardiState }[] = [];
  const seen = new Set<string>();
  const walk = (cur: NardiState, steps: Step[]) => {
    const moves = legalSteps(cur);
    if (moves.length === 0 || cur.dice.length === 0) {
      plans.push({ steps, end: cur });
      return;
    }
    for (const st of moves) {
      const next = applyStep(cur, st);
      const key = keyOf(next);
      if (seen.has(key)) continue;
      seen.add(key);
      walk(next, [...steps, st]);
    }
  };
  walk(s, []);
  return plans;
}
