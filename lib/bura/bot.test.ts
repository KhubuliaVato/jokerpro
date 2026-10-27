import { describe, expect, it } from "vitest";
import { botMove, STRONG_STYLE, type BuraStyle } from "./bot";
import { createGame, finishTrick, isLegal, nextRound, playCards, type BuraPlayers, type BuraState } from "./engine";

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
      else if (s.phase === "trickEnd") s = finishTrick(s);
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
      else if (s.phase === "trickEnd") s = finishTrick(s);
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
