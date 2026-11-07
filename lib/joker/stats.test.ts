import { describe, expect, it } from "vitest";
import { advance, botMove, isActivePhase } from "./online";
import { createGame, type GameState } from "./engine";
import { DEFAULT_RULES } from "./rules";
import { gameStats } from "./stats";

function finishedGame(): GameState {
  let s = createGame({ ...DEFAULT_RULES, format: "nine" });
  for (let guard = 0; guard < 20000 && s.phase !== "gameEnd"; guard++) s = isActivePhase(s) ? botMove(s) : advance(s);
  return s;
}

describe("game statistics", () => {
  it("adds up to the hands and tricks of the game", () => {
    const game = finishedGame();
    const stats = gameStats(game);
    expect(stats).toHaveLength(4);
    stats.forEach((s, p) => {
      expect(s.hands).toBe(16);
      expect(s.hits + s.fewer + s.more).toBe(16);
      expect(s.passesKept).toBeLessThanOrEqual(s.passes);
      expect(s.khishtis).toBeLessThanOrEqual(16 - s.hits + 0);
      expect(s.streak).toBeLessThanOrEqual(s.hits);
      expect(s.tricks).toBe(game.history.reduce((n, h) => n + h.taken[p], 0));
      expect(s.worst).toBeLessThanOrEqual(s.best);
      expect(s.jokers).toBeNull();
    });
    // in every hand all the cards are taken by somebody
    expect(stats.reduce((n, s) => n + s.tricks, 0)).toBe(16 * 9);
  });

  it("counts the premiums of the rounds", () => {
    const game = finishedGame();
    const stats = gameStats(game);
    game.premiums.forEach((row, pulka) => {
      row.forEach((v, p) => {
        if (v > 0) expect(stats[p].premiums).toBeGreaterThan(0);
        void pulka;
      });
    });
  });
});

describe("playOut (developer tool)", () => {
  it("plays a game to its end at once, from the middle of a hand", async () => {
    const { playOut } = await import("./online");
    let s = createGame({ ...DEFAULT_RULES, format: "nine" });
    for (let i = 0; i < 12; i++) s = isActivePhase(s) ? botMove(s) : advance(s);
    const end = playOut(s);
    expect(end.phase).toBe("gameEnd");
    expect(end.history).toHaveLength(16);
  });
});
