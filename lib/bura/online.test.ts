import { describe, expect, it } from "vitest";
import { createGame, finishTrick, legalPlays, nextRound, playCards, type BuraPlayers, type BuraState } from "./engine";
import { advance, resultFor, settle, viewFor } from "./online";

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Plays random legal moves until `stop` says so. */
function playUntil(players: BuraPlayers, seed: number, stop: (s: BuraState) => boolean): BuraState {
  const r = rng(seed);
  let s = createGame(players, r);
  for (let i = 0; i < 5000 && !stop(s); i++) {
    if (s.phase === "roundEnd") s = nextRound(s, r);
    else if (s.phase === "trickEnd") s = finishTrick(s);
    else {
      const options = legalPlays(s);
      s = playCards(s, options[Math.floor(r() * options.length)].map((c) => c.id));
    }
  }
  return s;
}

describe("views", () => {
  for (const n of [2, 4] as const) {
    it(`${n} players: a view shows only the viewer's own cards and puts them at seat 0`, () => {
      const s = playUntil(n, 5, (g) => g.tricks[0] + g.tricks[1] >= 3 && g.phase === "play");
      for (let seat = 0; seat < n; seat++) {
        const v = viewFor(s, seat);
        expect(v.hands[0]).toEqual(s.hands[seat]);
        for (let k = 1; k < n; k++) {
          expect(v.hands[k]).toHaveLength(s.hands[(seat + k) % n].length);
          expect(v.hands[k].every((c) => c.id.startsWith("hidden-"))).toBe(true);
        }
        // the pile is blank except for the trump card at the bottom
        expect(v.deck).toHaveLength(s.deck.length);
        expect(v.deck.slice(0, -1).every((c) => c.id.startsWith("deck-"))).toBe(true);
        expect(v.seen).toEqual([]);
        expect(v.turn).toBe((s.turn - seat + n) % n);
        // my team is always team 0 in my view
        expect(v.scores[0]).toBe(s.scores[seat % 2]);
        expect(v.piles[0]).toBe(s.piles[seat % 2]);
        expect(v.tricks[0]).toBe(s.tricks[seat % 2]);
      }
    });

    it(`${n} players: what a player may play on their view is what the server allows`, () => {
      const s = playUntil(n, 9, (g) => g.phase === "play" && g.trick.length === 1 && g.tricks[0] + g.tricks[1] >= 2);
      const v = viewFor(s, s.turn);
      expect(v.turn).toBe(0);
      const real = legalPlays(s).map((p) => p.map((c) => c.id).sort().join());
      const seen = legalPlays(v).map((p) => p.map((c) => c.id).sort().join());
      expect(seen.sort()).toEqual(real.sort());
      // and playing on the view gives the same trick
      const ids = legalPlays(v)[0].map((c) => c.id);
      const after = playCards(s, ids);
      const afterView = playCards(v, ids);
      expect(afterView.trick.map((p) => p.cards.map((c) => c.id))).toEqual(viewFor(after, s.turn).trick.map((p) => p.cards.map((c) => c.id)));
    });
  }

  it("the result and the winning team are turned for the viewer", () => {
    const s = playUntil(2, 3, (g) => g.phase === "roundEnd" || g.phase === "gameEnd");
    const v0 = viewFor(s, 0);
    const v1 = viewFor(s, 1);
    expect(v0.result?.piles).toEqual(s.result?.piles);
    expect(v1.result?.piles).toEqual([...s.result!.piles].reverse());
    if (s.result!.winner !== null) expect(v1.result!.winner).toBe(1 - s.result!.winner!);
  });
});

describe("server helpers", () => {
  it("settle lets bots play until a human has to move, and stops at a finished trick", () => {
    const s = createGame(2, rng(21));
    const humanSeat = s.turn === 0 ? 1 : 0;
    const out = settle(s, (seat) => seat !== humanSeat);
    expect(["play", "trickEnd"]).toContain(out.phase);
    if (out.phase === "play") expect(out.turn).toBe(humanSeat);
  });

  it("advance moves on after a trick and after a round, and result is by team", () => {
    const s = playUntil(4, 2, (g) => g.phase === "trickEnd");
    expect(advance(s).phase).toBe("play");
    const done = playUntil(2, 4, (g) => g.phase === "gameEnd");
    expect(done.scores.some((v) => v >= done.target)).toBe(true);
    const a = resultFor(done, 0);
    const b = resultFor(done, 1);
    expect(new Set([a.place, b.place])).toEqual(new Set([1, 2]));
    expect(a.score).toBe(done.scores[0]);
    expect(b.scores).toEqual([done.scores[1], done.scores[0]]);
  });
});
