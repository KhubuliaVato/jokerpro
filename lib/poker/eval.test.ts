import { describe, expect, it } from "vitest";
import type { NormalCard, Suit } from "../joker/cards";
import { CATEGORY, compareHands, evaluate } from "./eval";

/** "AS KS 10H" -> cards (rank then suit letter). */
function hand(text: string): NormalCard[] {
  const rankOf: Record<string, number> = { J: 11, Q: 12, K: 13, A: 14 };
  return text.split(" ").map((t) => {
    const suit = t.slice(-1) as Suit;
    const r = t.slice(0, -1);
    const rank = (rankOf[r] ?? Number(r)) as NormalCard["rank"];
    return { joker: false, suit, rank, id: t };
  });
}
const beats = (a: string, b: string) => compareHands(evaluate(hand(a)), evaluate(hand(b)));

describe("hand categories", () => {
  const cat = (t: string) => evaluate(hand(t)).category;
  it("recognises every hand of the page", () => {
    expect(cat("10S JS QS KS AS")).toBe(CATEGORY.straightFlush);
    expect(cat("9H 9S 9D 9C 2H")).toBe(CATEGORY.fourOfAKind);
    expect(cat("KH KS KD 4C 4H")).toBe(CATEGORY.fullHouse);
    expect(cat("2H 7H 9H JH KH")).toBe(CATEGORY.flush);
    expect(cat("5H 6S 7D 8C 9H")).toBe(CATEGORY.straight);
    expect(cat("QH QS QD 4C 8H")).toBe(CATEGORY.threeOfAKind);
    expect(cat("QH QS 4D 4C 8H")).toBe(CATEGORY.twoPair);
    expect(cat("QH QS 5D 4C 8H")).toBe(CATEGORY.pair);
    expect(cat("AH QS 5D 4C 8H")).toBe(CATEGORY.highCard);
  });

  it("plays the ace low in a straight, and only there", () => {
    expect(cat("AH 2S 3D 4C 5H")).toBe(CATEGORY.straight);
    expect(cat("AH 2S 3D 4C 6H")).toBe(CATEGORY.highCard);
    expect(cat("QH KS AD 2C 3H")).toBe(CATEGORY.highCard); // no wrap-around
    expect(beats("2H 3S 4D 5C 6H", "AH 2S 3D 4C 5H")).toBeGreaterThan(0); // the wheel is the lowest straight
  });
});

describe("ordering", () => {
  it("ranks the categories as the page lists them", () => {
    const order = [
      "AH QS 5D 4C 8H",
      "QH QS 5D 4C 8H",
      "QH QS 4D 4C 8H",
      "QH QS QD 4C 8H",
      "5H 6S 7D 8C 9H",
      "2H 7H 9H JH KH",
      "KH KS KD 4C 4H",
      "9H 9S 9D 9C 2H",
      "10S JS QS KS AS",
    ];
    for (let i = 1; i < order.length; i++) expect(beats(order[i], order[i - 1])).toBeGreaterThan(0);
  });

  it("breaks ties with the next cards: 9-9-7-4-2 beats 9-9-5-3-2", () => {
    expect(beats("9H 9S 7D 4C 2H", "9D 9C 5H 3S 2D")).toBeGreaterThan(0);
  });

  it("breaks equal pairs with the fifth card: Q-Q-6-6-J beats Q-Q-6-6-10", () => {
    expect(beats("QH QS 6D 6C JH", "QD QC 6H 6S 10D")).toBeGreaterThan(0);
  });

  it("compares the higher pair first, then the lower one", () => {
    expect(beats("KH KS 2D 2C 3H", "QD QC JH JS 10D")).toBeGreaterThan(0);
    expect(beats("KH KS 5D 5C 3H", "KD KC 4H 4S AD")).toBeGreaterThan(0);
  });

  it("an ace-high hand beats a king-high hand", () => {
    expect(beats("AH 9S 7D 5C 3H", "KD QC JH 9S 7D")).toBeGreaterThan(0);
  });

  it("suits have no rank: identical hands tie", () => {
    expect(beats("AH KS 7D 5C 3H", "AD KC 7H 5S 3D")).toBe(0);
    expect(beats("2H 7H 9H JH KH", "2S 7S 9S JS KS")).toBe(0);
  });

  it("compares fours and full houses by the group first", () => {
    expect(beats("9H 9S 9D 9C 2H", "8H 8S 8D 8C AH")).toBeGreaterThan(0);
    expect(beats("3H 3S 3D 2C 2H", "2H 2S 2D AC AH")).toBeGreaterThan(0);
  });
});

describe("partial hands (what stud shows)", () => {
  it("judges one to four cards by their groups", () => {
    expect(compareHands(evaluate(hand("AH")), evaluate(hand("KS")))).toBeGreaterThan(0);
    expect(compareHands(evaluate(hand("5H 5S")), evaluate(hand("AH KS")))).toBeGreaterThan(0);
    expect(compareHands(evaluate(hand("2H 2S 2D")), evaluate(hand("AH AS KD 4C")))).toBeGreaterThan(0);
  });
});
