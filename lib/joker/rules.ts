export interface Rules {
  /** "full": 24 hands in four pulkas, "nine": 16 hands of nine cards. */
  format: "full" | "nine";
  /** Penalty for bidding at least one trick and taking none. */
  khishti: number;
  /** Score for a successful pass. */
  passScore: number;
  /** Points per trick when the bid was missed (and for a failed pass). */
  missPerTrick: number;
  /** Whoever makes every hand of a pulka gets their best hand of it added again. */
  pulkaPremium: boolean;
}

export const DEFAULT_RULES: Rules = {
  format: "full",
  khishti: 200,
  passScore: 50,
  missPerTrick: 10,
  pulkaPremium: true,
};

/** Cards dealt per hand, grouped by pulka. */
export function schedule(format: Rules["format"]): number[][] {
  if (format === "nine") {
    return [[9, 9, 9, 9], [9, 9, 9, 9], [9, 9, 9, 9], [9, 9, 9, 9]];
  }
  return [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [9, 9, 9, 9],
    [8, 7, 6, 5, 4, 3, 2, 1],
    [9, 9, 9, 9],
  ];
}

export function handPoints(
  bid: number,
  taken: number,
  cards: number,
  rules: Rules,
): number {
  if (bid === 0) {
    return taken === 0 ? rules.passScore : rules.missPerTrick * taken;
  }
  if (taken === bid) {
    return bid === cards ? bid * 100 : (bid + 1) * 50;
  }
  if (taken === 0) return -rules.khishti;
  return rules.missPerTrick * taken;
}
