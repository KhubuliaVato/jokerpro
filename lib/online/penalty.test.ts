import { describe, expect, it } from "vitest";
import { leftProgress, quitPenalty, RETURN_WINDOW_MS, returnedPenalty } from "./penalty";

describe("leaving a running game", () => {
  it("costs 10 at the very start and 6 at the very end", () => {
    expect(quitPenalty(0)).toBe(10);
    expect(quitPenalty(1)).toBe(6);
  });

  it("costs less the later the player leaves, never outside 6..10", () => {
    let last = Infinity;
    for (let p = 0; p <= 1; p += 0.05) {
      const cost = quitPenalty(p);
      expect(cost).toBeLessThanOrEqual(last);
      expect(cost).toBeGreaterThanOrEqual(6);
      expect(cost).toBeLessThanOrEqual(10);
      last = cost;
    }
    expect(quitPenalty(0.5)).toBe(8);
  });

  it("copes with progress outside 0..1 or missing", () => {
    expect(quitPenalty(-3)).toBe(10);
    expect(quitPenalty(7)).toBe(6);
    expect(quitPenalty(NaN)).toBe(10);
  });

  it("is halved for a player who came back in time", () => {
    expect(returnedPenalty(0)).toBe(5);
    expect(returnedPenalty(1)).toBe(3);
  });

  it("measures how far the game had got from the versions", () => {
    expect(leftProgress(10, 40)).toBe(0.25);
    expect(leftProgress(null, 40)).toBe(0);
    expect(leftProgress(80, 40)).toBe(1);
    expect(leftProgress(5, 0)).toBe(0);
  });

  it("gives 7 minutes to return", () => {
    expect(RETURN_WINDOW_MS).toBe(420_000);
  });
});
