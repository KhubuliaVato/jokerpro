import type { Card, Suit } from "./cards";

export const TRUMP_VALUE: Record<number, number> = {
  14: 0.95,
  13: 0.8,
  12: 0.65,
  11: 0.5,
  10: 0.4,
  9: 0.3,
  8: 0.25,
  7: 0.2,
  6: 0.15,
};
const SIDE_VALUE: Record<number, number> = { 14: 0.75, 13: 0.4, 12: 0.15 };

/**
 * Rough number of tricks a hand should take with `trump`: how good the cards are, independent of how they are
 * played. Used by the bots to bid, and to tell a strong deal from a weak one.
 */
export function expectedTricks(hand: Card[], trump: Suit | null): number {
  let est = 0;
  let trumpCount = 0;
  for (const c of hand) {
    if (c.joker) {
      est += 0.95;
    } else if (c.suit === trump) {
      trumpCount++;
      est += TRUMP_VALUE[c.rank];
    } else {
      const suitLen = hand.filter((x) => !x.joker && x.suit === c.suit).length;
      const v = SIDE_VALUE[c.rank] ?? 0;
      // A lone king or queen is easily caught.
      est += suitLen === 1 && c.rank < 14 ? v * 0.5 : v;
    }
  }
  if (trumpCount >= 4) est += (trumpCount - 3) * 0.3;
  return est;
}
