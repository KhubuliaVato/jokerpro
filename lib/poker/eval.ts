import { localizedList } from "../lang";
import type { NormalCard } from "../joker/cards";

/** From the weakest hand to the strongest (five of a kind needs wild cards, which are not played here). */
export const CATEGORY = {
  highCard: 0,
  pair: 1,
  twoPair: 2,
  threeOfAKind: 3,
  straight: 4,
  flush: 5,
  fullHouse: 6,
  fourOfAKind: 7,
  straightFlush: 8,
} as const;

export const CATEGORY_NAME = localizedList([
  ["უმაღლესი კარტი", "High card", "Старшая карта"],
  ["წყვილი", "Pair", "Пара"],
  ["ორი წყვილი", "Two pair", "Две пары"],
  ["სამეული", "Three of a kind", "Сет"],
  ["სტრეიტი", "Straight", "Стрит"],
  ["ფლეში", "Flush", "Флеш"],
  ["ფულ-ჰაუსი", "Full house", "Фулл-хаус"],
  ["კარე", "Four of a kind", "Каре"],
  ["სტრეიტ-ფლეში", "Straight flush", "Стрит-флеш"],
]);

export interface HandValue {
  category: number;
  /** Ranks in the order that breaks ties: the made groups first (biggest group, then highest), then the kickers. */
  ranks: number[];
}

/**
 * Value of one to five cards. With fewer than five cards only the groups count (that is how "the best hand showing"
 * is judged in stud); with five, straights and flushes count as well. Suits have no rank.
 */
export function evaluate(cards: NormalCard[]): HandValue {
  const counts = new Map<number, number>();
  for (const c of cards) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const ranks = groups.map(([rank]) => rank);
  const shape = groups.map(([, n]) => n);

  if (cards.length === 5) {
    const flush = cards.every((c) => c.suit === cards[0].suit);
    const distinct = ranks.length === 5;
    // The ace also plays low: A-2-3-4-5 is the lowest straight.
    const high = ranks[0];
    const wheel = distinct && high === 14 && ranks[1] === 5 && ranks[4] === 2;
    const straight = distinct && (high - ranks[4] === 4 || wheel);
    const straightRanks = wheel ? [5, 4, 3, 2, 1] : ranks;
    if (straight && flush) return { category: CATEGORY.straightFlush, ranks: straightRanks };
    if (shape[0] === 4) return { category: CATEGORY.fourOfAKind, ranks };
    if (shape[0] === 3 && shape[1] === 2) return { category: CATEGORY.fullHouse, ranks };
    if (flush) return { category: CATEGORY.flush, ranks };
    if (straight) return { category: CATEGORY.straight, ranks: straightRanks };
  }
  if (shape[0] === 4) return { category: CATEGORY.fourOfAKind, ranks };
  if (shape[0] === 3 && shape[1] === 2) return { category: CATEGORY.fullHouse, ranks };
  if (shape[0] === 3) return { category: CATEGORY.threeOfAKind, ranks };
  if (shape[0] === 2 && shape[1] === 2) return { category: CATEGORY.twoPair, ranks };
  if (shape[0] === 2) return { category: CATEGORY.pair, ranks };
  return { category: CATEGORY.highCard, ranks };
}

/** Positive when `a` beats `b`, negative when `b` wins, 0 for a tie (the pot is then split). */
export function compareHands(a: HandValue, b: HandValue): number {
  if (a.category !== b.category) return a.category - b.category;
  const n = Math.max(a.ranks.length, b.ranks.length);
  for (let i = 0; i < n; i++) {
    const d = (a.ranks[i] ?? 0) - (b.ranks[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export const handName = (cards: NormalCard[]) => CATEGORY_NAME[evaluate(cards).category];

/** The best five of up to seven cards (a player's two hole cards and the board), with the five cards that make it. */
export function bestHand(cards: NormalCard[]): { value: HandValue; cards: NormalCard[] } {
  if (cards.length <= 5) return { value: evaluate(cards), cards };
  let best: { value: HandValue; cards: NormalCard[] } | null = null;
  const pick: NormalCard[] = [];
  const walk = (start: number) => {
    if (pick.length === 5) {
      const value = evaluate(pick);
      if (!best || compareHands(value, best.value) > 0) best = { value, cards: pick.slice() };
      return;
    }
    for (let i = start; i < cards.length; i++) {
      pick.push(cards[i]);
      walk(i + 1);
      pick.pop();
    }
  };
  walk(0);
  return best!;
}
