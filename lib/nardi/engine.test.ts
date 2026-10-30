import { describe, expect, it } from "vitest";
import { botTurn } from "./bot";
import { BAR, CHECKERS, count, legalSteps, newGame, roll, step, winPoints, type NardiState } from "./engine";

const total = (s: NardiState, p: 0 | 1) => {
  let n = s.off[p] + s.bar[p];
  for (let r = 1; r <= 24; r++) n += count(s, p, r);
  return n;
};

/** A position with the given checkers (own point → count), white to move with the dice already rolled. */
function setup(
  white: Record<number, number>,
  black: Record<number, number>,
  dice: number[],
  extra: Partial<NardiState> = {},
): NardiState {
  const s = newGame(0);
  s.points.fill(0);
  for (const [r, n] of Object.entries(white)) s.points[Number(r) - 1] += n;
  for (const [r, n] of Object.entries(black)) s.points[24 - Number(r)] -= n;
  return { ...s, dice, rolled: dice.slice(0, 2), ...extra };
}

describe("nardi (backgammon) engine", () => {
  it("starts with the usual 2-5-3-5 setup, 15 checkers each, opposite ways round", () => {
    const s = newGame();
    for (const p of [0, 1] as const) {
      expect([24, 13, 8, 6].map((r) => count(s, p, r))).toEqual([2, 5, 3, 5]);
      expect(total(s, p)).toBe(CHECKERS);
    }
    // white's 24-point is black's 1-point
    expect(s.points[23]).toBe(2);
    expect(s.points[0]).toBe(-2);
  });

  it("cannot land on two or more opponent checkers", () => {
    const s = setup({ 10: 1 }, { 20: 0, 5: 2, 24: 13 }, [3, 5]);
    // black rel 5 = white's point 20; use white 10 → 7 (3) free, 10 → 5 (5) free: block white's 5 with black's rel 20
    const t = setup({ 10: 1 }, { 20: 2, 24: 13 }, [5, 3]);
    expect(legalSteps(t).some((m) => m.to === 5)).toBe(false);
    expect(legalSteps(t).some((m) => m.to === 7)).toBe(true);
    expect(legalSteps(s).length).toBeGreaterThan(0);
  });

  it("hits a lone opponent checker and sends it to the bar", () => {
    const s = setup({ 10: 1 }, { 20: 1, 24: 14 }, [5, 1]);
    // black rel 20 stands on white's point 5
    const hit = step(s, { from: 10, to: 5, die: 5 });
    expect(hit.bar[1]).toBe(1);
    expect(count(hit, 1, 20)).toBe(0);
    expect(count(hit, 0, 5)).toBe(1);
  });

  it("makes a checker on the bar enter first, on the opponent's home board", () => {
    const s = setup({ 10: 1 }, { 12: 15 }, [4, 2], { bar: [1, 0] });
    const moves = legalSteps(s);
    expect(moves.every((m) => m.from === BAR)).toBe(true);
    expect(moves.map((m) => m.to).sort()).toEqual([21, 23]);
  });

  it("blocks entering on a point held by two opponent checkers, and passes when nothing enters", () => {
    // black holds white's entry points 24 .. 19 (white enters at 25 - die); black rel 1..6 = white 24..19
    const wall: Record<number, number> = { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 24: 3 };
    const s = setup({ 10: 1 }, wall, [], { bar: [1, 0], rolled: [] });
    const passed = roll(s, [3, 5]);
    expect(passed.passed).toBe(0);
    expect(passed.turn).toBe(1);
  });

  it("plays both dice when possible, and only the larger one when only one can be played", () => {
    // 4 is blocked after the 3 (no way to use both): white 5, black holds point 2 and 1 with two each
    const s = setup({ 5: 1 }, { 23: 2, 12: 13 }, [3, 4]);
    // black rel 23 = white's point 2 (two checkers). 5-3=2 blocked; 5-4=1 free, then 1 - 3 off? not all home: all home yes (5 is in home)
    const moves = legalSteps(s);
    // the 3 is blocked first, the 4 (to point 1) then lets the 3 bear off: only the 4 starts a full turn
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.die === 4)).toBe(true);
  });

  it("bears off exactly, and with a smaller checker only from the highest point", () => {
    const s = setup({ 6: 1, 3: 1 }, { 12: 15 }, [6, 2]);
    expect(legalSteps(s).some((m) => m.from === 6 && m.to === 0 && m.die === 6)).toBe(true);
    const t = setup({ 4: 1, 3: 1 }, { 12: 15 }, [6, 5]);
    expect(legalSteps(t).every((m) => m.from === 4 && m.to === 0)).toBe(true);
  });

  it("cannot bear off while a checker is outside the home board or on the bar", () => {
    const s = setup({ 7: 1, 2: 1 }, { 12: 15 }, [2, 1]);
    expect(legalSteps(s).every((m) => m.to > 0)).toBe(true);
    const bar = setup({ 2: 1 }, { 12: 15 }, [2, 1], { bar: [1, 0] });
    expect(legalSteps(bar).every((m) => m.from === BAR)).toBe(true);
  });

  it("declares a winner and scores a regular win, mars and kox", () => {
    const last = { from: 1, to: 0, die: 2 };
    const oin = setup({ 1: 1 }, { 12: 14 }, [1, 2], { off: [14, 1] });
    expect(winPoints(step(oin, last))).toBe(1);
    const mars = setup({ 1: 1 }, { 12: 15 }, [1, 2], { off: [14, 0] });
    const done = step(mars, last);
    expect(done.winner).toBe(0);
    expect(winPoints(done)).toBe(2);
    // black still on the bar (or in white's home board): kox
    const kox = setup({ 1: 1 }, { 12: 14 }, [1, 2], { off: [14, 0], bar: [0, 1] });
    expect(winPoints(step(kox, last))).toBe(3);
  });

  it("keeps all checkers and ends in a win in random play-outs", () => {
    for (let game = 0; game < 30; game++) {
      let s = newGame(game % 2 === 0 ? 0 : 1);
      let guard = 0;
      while (s.winner === null && guard++ < 5000) {
        if (s.dice.length === 0) {
          s = roll(s);
        } else {
          const moves = legalSteps(s);
          s = step(s, moves[Math.floor(Math.random() * moves.length)]);
        }
        expect(total(s, 0)).toBe(CHECKERS);
        expect(total(s, 1)).toBe(CHECKERS);
      }
      expect(s.winner).not.toBeNull();
    }
  });

  it("lets the bot finish a game against itself", () => {
    let s = newGame();
    let guard = 0;
    while (s.winner === null && guard++ < 3000) {
      if (s.dice.length === 0) s = roll(s);
      else for (const st of botTurn(s)) s = step(s, st);
    }
    expect(s.winner).not.toBeNull();
  });
});
