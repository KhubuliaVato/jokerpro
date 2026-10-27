import { describe, expect, it } from "vitest";
import { botAct, botMove, STRONG_STYLE, type BuraStyle } from "./bot";
import { act, createGame, decideVar, finishTrick, isLegal, nextRound, playCards, type BuraPlayers, type BuraState } from "./engine";

/** The trick goes to its winner, who just carries on (no "var"). */
const carryOn = (s: BuraState): BuraState => {
  const next = finishTrick(s);
  return next.phase === "var" ? decideVar(next, false) : next;
};

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Plays whole matches between two kinds of player (even seats against odd seats); returns how often the first team won. */
function match(players: BuraPlayers, a: BuraStyle, b: BuraStyle, games: number, seed: number) {
  const r = rng(seed);
  let wins = 0;
  for (let g = 0; g < games; g++) {
    let s: BuraState = createGame(players, r);
    // swap who sits where every other game so the deal's luck evens out
    const aSeats = g % 2 === 0 ? 0 : 1;
    for (let guard = 0; s.phase !== "gameEnd" && guard < 5000; guard++) {
      if (s.phase === "roundEnd") s = nextRound(s, r);
      else if (s.phase === "trickEnd") s = carryOn(s);
      else {
        const style = s.turn % 2 === aSeats ? a : b;
        s = playCards(s, botMove(s, style, r));
      }
    }
    expect(s.phase).toBe("gameEnd");
    if (s.scores[aSeats] >= s.target) wins++;
  }
  return wins / games;
}

describe("bura bot", () => {
  it("always makes a legal move", () => {
    const r = rng(11);
    let s = createGame(2, r);
    for (let guard = 0; s.phase !== "gameEnd" && guard < 3000; guard++) {
      if (s.phase === "roundEnd") s = nextRound(s, r);
      else if (s.phase === "trickEnd") s = carryOn(s);
      else {
        const ids = botMove(s, { samples: 6, mistake: 0.3 }, r);
        expect(isLegal(s, ids)).toBe(true);
        s = playCards(s, ids);
      }
    }
    expect(s.phase).toBe("gameEnd");
  });

  it("beats a bot that plays at random, with two and with four players", () => {
    const random: BuraStyle = { samples: 1, mistake: 1 };
    expect(match(2, STRONG_STYLE, random, 24, 3)).toBeGreaterThan(0.75);
    expect(match(4, { samples: 24, mistake: 0 }, random, 12, 4)).toBeGreaterThan(0.6);
  }, 120000);
});

describe("bot calls and var", () => {
  it("a bot says var exactly when its team has 31 points", () => {
    const r = rng(11);
    const g = createGame(2, r);
    const state = (mine: number): BuraState => ({ ...g, phase: "var", turn: 0, piles: [mine, 0] });
    expect(botAct(state(31), STRONG_STYLE, r)).toEqual({ type: "var", say: true });
    expect(botAct(state(30), STRONG_STYLE, r)).toEqual({ type: "var", say: false });
  });

  it("a hopeless position is given in to, a winning one is accepted", () => {
    const r = rng(12);
    const g = createGame(2, r);
    const base = (mine: number, theirs: number): BuraState => ({
      ...g,
      phase: "call",
      turn: 1,
      call: { by: 0, level: 2 },
      hands: [g.hands[0], g.hands[1]],
      piles: [mine, theirs],
      price: 1,
      tricks: [3, 3],
    });
    // the caller (team 0) holds 100 points, the bot nothing: giving in costs one point, accepting would cost two
    expect(botAct(base(100, 0), STRONG_STYLE, r)).toEqual({ type: "answer", answer: "fold" });
    const strong = botAct(base(0, 100), STRONG_STYLE, r);
    expect(strong.type).toBe("answer");
    expect(strong.type === "answer" && strong.answer).not.toBe("fold");
  });

  it("whole matches with calls and var always finish and stay legal", () => {
    for (const n of [2, 4] as const) {
      const r = rng(30 + n);
      let s = createGame(n, r);
      let steps = 0;
      while (s.phase !== "gameEnd" && steps++ < 4000) {
        if (s.phase === "roundEnd") s = nextRound(s, r);
        else if (s.phase === "trickEnd") s = finishTrick(s);
        else s = act(s, botAct(s, { samples: 6, mistake: 0.2 }, r));
      }
      expect(s.phase).toBe("gameEnd");
    }
  }, 60000);
});
