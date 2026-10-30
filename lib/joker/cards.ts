import { tt } from "../lang";
export type Suit = "S" | "C" | "D" | "H";
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface NormalCard {
  joker: false;
  suit: Suit;
  rank: Rank;
  id: string;
}
export interface JokerCard {
  joker: true;
  id: string;
}
export type Card = NormalCard | JokerCard;

export type Rng = () => number;

/** Display order: alternating colours so neighbouring suits are easy to tell apart. */
export const SUITS: Suit[] = ["S", "H", "C", "D"];

export const SUIT_SYMBOL: Record<Suit, string> = {
  S: "♠",
  C: "♣",
  D: "♦",
  H: "♥",
};

export const SUIT_NAME: Record<Suit, string> = {
  get S() {
    return tt("ყვავი", "Spades", "Пики");
  },
  get C() {
    return tt("ჯვარი", "Clubs", "Трефы");
  },
  get D() {
    return tt("აგური", "Diamonds", "Бубны");
  },
  get H() {
    return tt("გული", "Hearts", "Червы");
  },
};

export const isRed = (suit: Suit) => suit === "D" || suit === "H";

const RANK_LABEL: Record<number, string> = {
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};
export const rankLabel = (rank: number) => RANK_LABEL[rank] ?? String(rank);

/** 36-card deck: black sixes are replaced by two jokers. */
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 6; rank <= 14; rank++) {
      if (rank === 6 && (suit === "S" || suit === "C")) continue;
      deck.push({ joker: false, suit, rank: rank as Rank, id: `${suit}${rank}` });
    }
  }
  deck.push({ joker: true, id: "J0" }, { joker: true, id: "J1" });
  return deck;
}

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function sortHand(cards: Card[]): Card[] {
  const suitOrder = (c: Card) => (c.joker ? -1 : SUITS.indexOf(c.suit));
  return cards.slice().sort((a, b) => {
    const s = suitOrder(a) - suitOrder(b);
    if (s !== 0) return s;
    if (a.joker || b.joker) return a.id.localeCompare(b.id);
    return b.rank - a.rank;
  });
}
