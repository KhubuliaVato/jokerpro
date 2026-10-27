import { describe, expect, it } from "vitest";
import { RANKS, rankFor } from "./ranks";

describe("rank ladder", () => {
  it("has a rank every 50 points up to 400, then the Joker at 1000", () => {
    expect(RANKS.map((r) => r.min)).toEqual([50, 100, 150, 200, 250, 300, 350, 400, 1000]);
    expect(RANKS[RANKS.length - 1].name).toBe("ჯოკერი");
  });

  it("starts new players on the first rank", () => {
    expect(rankFor(50).rank.name).toBe("ბრინჯაო");
    expect(rankFor(0).rank.name).toBe("ბრინჯაო");
    expect(rankFor(0).progress).toBe(0);
    expect(rankFor(49).toNext).toBe(51);
  });

  it("moves up exactly at the thresholds and down when points are lost", () => {
    expect(rankFor(99).rank.name).toBe("ბრინჯაო");
    expect(rankFor(100).rank.name).toBe("ვერცხლი");
    expect(rankFor(399).rank.name).toBe("ალმასი");
    expect(rankFor(400).rank.name).toBe("ოსტატი");
    expect(rankFor(999).rank.name).toBe("ოსტატი");
    expect(rankFor(1000).rank.name).toBe("ჯოკერი");
    expect(rankFor(97).rank.name).toBe("ბრინჯაო");
  });

  it("reports progress to the next rank", () => {
    expect(rankFor(125).progress).toBeCloseTo(0.5);
    expect(rankFor(125).toNext).toBe(25);
    expect(rankFor(700).progress).toBeCloseTo(0.5); // Master → Joker spans 600 points
    expect(rankFor(5000)).toMatchObject({ next: null, progress: 1, toNext: 0 });
  });
});
