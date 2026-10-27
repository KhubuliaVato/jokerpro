import { describe, expect, it } from "vitest";
import { botBid, botChooseTrump, botPlay } from "./bot";
import { BOTS, botById, DEFAULT_BOTS, randomBots, STANDARD_STYLE, type BotStyle } from "./botProfiles";
import { advance, isActivePhase } from "./online";
import {
  chooseTrump,
  createGame,
  placeBid,
  playCard,
  totals,
  type GameState,
} from "./engine";
import { DEFAULT_RULES } from "./rules";

/** Plays one game: seat 0 uses `me`, the others use `others`. Returns seat 0's score minus the others' average. */
function edge(me: BotStyle, others: BotStyle): number {
  let s: GameState = createGame({ ...DEFAULT_RULES, format: "nine" });
  for (let guard = 0; guard < 20000 && s.phase !== "gameEnd"; guard++) {
    if (!isActivePhase(s)) {
      s = advance(s);
      continue;
    }
    const style = s.turn === 0 ? me : others;
    s =
      s.phase === "trump"
        ? chooseTrump(s, botChooseTrump(s.hands[s.turn]))
        : s.phase === "bidding"
          ? placeBid(s, botBid(s, s.turn, style))
          : playCard(s, botPlay(s, s.turn, style));
  }
  const t = totals(s);
  return t[0] - (t[1] + t[2] + t[3]) / 3;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("bot roster", () => {
  it("has three bots per level, all with unique ids", () => {
    expect(new Set(BOTS.map((b) => b.id)).size).toBe(BOTS.length);
    for (const tier of ["easy", "medium", "hard"] as const) {
      expect(BOTS.filter((b) => b.tier === tier)).toHaveLength(3);
    }
    expect(DEFAULT_BOTS.map((id) => botById(id).name)).toEqual(["ლევანი", "ნინო", "მარიამი"]);
  });

  it("draws three different random bots", () => {
    for (let i = 0; i < 20; i++) {
      const picked = randomBots();
      expect(new Set(picked).size).toBe(3);
      expect(randomBots("hard").every((id) => botById(id).tier === "hard")).toBe(true);
    }
  });
});

describe("bot strength", () => {
  it("a standard bot beats beginners, and beginners lose to it", () => {
    const easy = botById("nika").style;
    const scores = Array.from({ length: 50 }, () => edge(STANDARD_STYLE, easy));
    expect(mean(scores)).toBeGreaterThan(0);
  });
});
