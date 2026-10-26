import { describe, expect, it } from "vitest";
import { achievements, bestStreak, computeStats, placeCounts, placeOf, rankFor } from "./stats";

describe("placeOf", () => {
  it("ranks by strictly higher scores, so ties share the better place", () => {
    expect(placeOf([300, 100, 50, -20])).toBe(1);
    expect(placeOf([100, 300, 50, 200])).toBe(3);
    expect(placeOf([100, 100, 100, 100])).toBe(1);
    expect(placeOf([-200, 50, 100, 50])).toBe(4);
  });
});

describe("computeStats", () => {
  it("handles no games", () => {
    expect(computeStats([])).toEqual({ played: 0, wins: 0, winRate: 0, best: null, avgPlace: null });
  });
  it("summarises wins, best score and average place", () => {
    const s = computeStats([
      { place: 1, score: 420 },
      { place: 3, score: 80 },
      { place: 1, score: 510 },
      { place: 4, score: -90 },
    ]);
    expect(s.played).toBe(4);
    expect(s.wins).toBe(2);
    expect(s.winRate).toBe(50);
    expect(s.best).toBe(510);
    expect(s.avgPlace).toBe(2.25);
  });
});


describe("placeCounts / bestStreak", () => {
  const newestFirst = [{ place: 1 }, { place: 1 }, { place: 3 }, { place: 1 }, { place: 1 }, { place: 1 }, { place: 4 }];
  it("counts places", () => {
    expect(placeCounts(newestFirst)).toEqual([5, 0, 1, 1]);
  });
  it("finds the longest win run regardless of order", () => {
    expect(bestStreak(newestFirst)).toBe(3);
    expect(bestStreak([])).toBe(0);
  });
});

describe("rankFor", () => {
  it("moves up at the thresholds and reports progress", () => {
    expect(rankFor(0).rank.name).toBe("დამწყები");
    expect(rankFor(4).progress).toBeCloseTo(0.8);
    expect(rankFor(5).rank.name).toBe("მოთამაშე");
    expect(rankFor(20).rank.name).toBe("გამოცდილი");
    expect(rankFor(150)).toMatchObject({ next: null, progress: 1 });
  });
});

describe("achievements", () => {
  it("unlocks from the history", () => {
    const none = achievements([]);
    expect(none.every((a) => !a.done)).toBe(true);
    const some = achievements([
      { place: 1, score: 520, format: "full" },
      { place: 1, score: 100, format: "nine" },
      { place: 1, score: 90, format: "nine" },
    ]);
    const done = some.filter((a) => a.done).map((a) => a.id);
    expect(done).toEqual(expect.arrayContaining(["first", "score", "streak", "full"]));
    expect(done).not.toContain("ten");
  });
});
