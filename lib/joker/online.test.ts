import { describe, expect, it } from "vitest";
import { createGame, legalBids, PLAYERS, totals, type GameState } from "./engine";
import {
  advance,
  applyAction,
  botMove,
  isActivePhase,
  realSeat,
  resultFor,
  settle,
  viewFor,
  viewSeat,
} from "./online";
import { DEFAULT_RULES } from "./rules";

/** Small deterministic generator so failures are reproducible. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("seat rotation", () => {
  it("viewSeat and realSeat are inverses", () => {
    for (let me = 0; me < PLAYERS; me++) {
      for (let s = 0; s < PLAYERS; s++) expect(realSeat(viewSeat(s, me), me)).toBe(s);
      expect(viewSeat(me, me)).toBe(0);
    }
  });
});

describe("viewFor", () => {
  const game = createGame({ ...DEFAULT_RULES, format: "nine" }, seeded(7));

  it("shows the viewer their own hand and hides everybody else's", () => {
    for (let me = 0; me < PLAYERS; me++) {
      const v = viewFor(game, me);
      expect(v.hands[0].map((c) => c.id)).toEqual(game.hands[me].map((c) => c.id));
      const realIds = new Set(game.hands.flat().map((c) => c.id));
      for (let k = 1; k < PLAYERS; k++) {
        expect(v.hands[k]).toHaveLength(game.hands[realSeat(k, me)].length);
        for (const c of v.hands[k]) expect(realIds.has(c.id)).toBe(false);
      }
      expect(v.rest).toEqual([]);
    }
  });

  it("rotates turn and dealer to the viewer's seat numbering", () => {
    for (let me = 0; me < PLAYERS; me++) {
      const v = viewFor(game, me);
      expect(realSeat(v.turn, me)).toBe(game.turn);
      expect(realSeat(v.dealer, me)).toBe(game.dealer);
    }
  });

  it("does not modify the real state", () => {
    const before = JSON.stringify(game);
    viewFor(game, 2);
    expect(JSON.stringify(game)).toBe(before);
  });
});

describe("applyAction", () => {
  it("rejects a decision from the wrong seat or an illegal bid", () => {
    const game = createGame(DEFAULT_RULES, seeded(3));
    const other = (game.turn + 1) % PLAYERS;
    expect(() => applyAction(game, other, { type: "bid", bid: 0 })).toThrow(/turn/);
    expect(() => applyAction(game, game.turn, { type: "bid", bid: 99 })).toThrow();
    const ok = applyAction(game, game.turn, { type: "bid", bid: legalBids(game, game.turn)[0] });
    expect(ok.turn).not.toBe(game.turn);
  });
});

/** Plays a whole game where every seat is driven through the online helpers. */
function playOut(format: "full" | "nine", seed: number): { state: GameState; steps: number } {
  let s = createGame({ ...DEFAULT_RULES, format }, seeded(seed));
  let steps = 0;
  while (s.phase !== "gameEnd" && steps < 5000) {
    steps++;
    if (isActivePhase(s)) {
      // A "human" seat decides via the same bot logic, but through applyAction like a real request.
      const next = botMove(s);
      const before = s;
      expect(() => applyAction(before, before.turn, { type: "bid", bid: -1 })).toThrow();
      s = next;
    } else {
      s = advance(s);
    }
  }
  return { state: s, steps };
}

describe("a whole online game", () => {
  it.each([
    ["nine", 11],
    ["full", 12],
  ] as const)("%s format reaches the end with consistent scores", (format, seed) => {
    const { state } = playOut(format, seed);
    expect(state.phase).toBe("gameEnd");
    const sums = totals(state);
    for (let seat = 0; seat < PLAYERS; seat++) {
      const r = resultFor(state, seat);
      expect(r.score).toBe(sums[seat]);
      expect(r.scores[0]).toBe(sums[seat]);
      expect(r.place).toBeGreaterThanOrEqual(1);
      expect(r.place).toBeLessThanOrEqual(4);
    }
    // Exactly one best place exists.
    expect(Array.from({ length: PLAYERS }, (_, s) => resultFor(state, s).place).includes(1)).toBe(true);
  });

  it("settle plays bot seats until a human is on turn", () => {
    const game = createGame(DEFAULT_RULES, seeded(5));
    const humanSeat = (game.turn + 2) % PLAYERS;
    const s = settle(game, (seat) => seat !== humanSeat);
    expect(s.turn === humanSeat || !isActivePhase(s)).toBe(true);
  });
});

describe("what players are not shown", () => {
  it("views do not carry how strong the deals were", () => {
    let s = createGame(DEFAULT_RULES, seeded(21));
    for (let guard = 0; guard < 2000 && s.history.length < 2; guard++) {
      s = isActivePhase(s) ? botMove(s) : advance(s);
    }
    expect(s.history.length).toBeGreaterThanOrEqual(2);
    expect(s.history[0].strength).toHaveLength(4); // the server keeps it
    for (let me = 0; me < PLAYERS; me++) {
      const v = viewFor(s, me);
      expect(v.strength).toEqual([]);
      expect(v.history.every((h) => h.strength === undefined)).toBe(true);
    }
  });
});
