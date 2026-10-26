import { buildDeck, SUITS, type Card, type NormalCard, type Suit } from "./cards";
import {
  legalBids,
  legalPlays,
  PLAYERS,
  trickWinner,
  type GameState,
  type Play,
  type PlayOption,
} from "./engine";

const TRUMP_VALUE: Record<number, number> = {
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

function expectedTricks(hand: Card[], trump: Suit | null): number {
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

/** Trump choice on the first three cards of a nine-card hand. `null` is no-trump. */
export function botChooseTrump(hand: Card[]): Suit | null {
  const jokers = hand.filter((c) => c.joker).length;
  const normal = hand.filter((c): c is NormalCard => !c.joker);
  let bestSuit: Suit = SUITS[0];
  let bestScore = -1;
  for (const suit of SUITS) {
    const cards = normal.filter((c) => c.suit === suit);
    const score =
      cards.reduce((a, c) => a + TRUMP_VALUE[c.rank], 0) +
      Math.max(0, cards.length - 1) * 0.5;
    if (score > bestScore) {
      bestScore = score;
      bestSuit = suit;
    }
  }
  const bez =
    normal.filter((c) => c.rank === 14).length +
    jokers +
    normal.filter((c) => c.rank === 13).length * 0.4;
  return bez >= 2.5 && bez > bestScore ? null : bestSuit;
}

export function botBid(s: GameState, player: number): number {
  const est = expectedTricks(s.hands[player], s.trump);
  const want = est < 0.45 ? 0 : Math.max(1, Math.round(est * 0.9));
  const legal = legalBids(s, player);
  return legal.reduce((best, b) =>
    Math.abs(b - want) < Math.abs(best - want) ? b : best,
  );
}

const fullDeck = buildDeck();

function unseenCards(s: GameState, hand: Card[]): Card[] {
  const known = new Set([...hand, ...s.played].map((c) => c.id));
  return fullDeck.filter((c) => !known.has(c.id));
}

/** Chance that a card played now still holds the trick against those yet to play. */
function winChance(s: GameState, player: number, opt: PlayOption): number {
  const plays: Play[] = [...s.trick, { player, ...opt }];
  if (trickWinner(plays, s.trump) !== player) return 0;
  const remaining = PLAYERS - plays.length;
  if (remaining === 0) return 1;
  const { card } = opt;
  if (card.joker) return opt.mode === "high" ? 0.97 : s.trick.length === 0 ? 0.1 : 0;

  const lead = plays[0];
  const suit = lead.card.joker ? (lead.suit as Suit) : lead.card.suit;
  const mine = card.suit === s.trump ? "trump" : "side";
  let threat = 0;
  for (const c of unseenCards(s, s.hands[player])) {
    if (c.joker) {
      threat += 0.6;
    } else if (c.suit === s.trump) {
      if (mine === "trump") threat += c.rank > card.rank ? 1 : 0;
      else threat += 0.4;
    } else if (mine === "side" && c.suit === suit && c.rank > card.rank) {
      threat += 1;
    }
  }
  return Math.pow(1 - remaining / 3, threat);
}

function cost(s: GameState, c: Card): number {
  if (c.joker) return 40;
  return c.rank - 6 + (c.suit === s.trump ? 10 : 0);
}

function pickSuit(s: GameState, hand: Card[], mode: "high" | "low"): Suit {
  const count = (suit: Suit) =>
    hand.filter((c) => !c.joker && c.suit === suit).length;
  const unseen = (suit: Suit) =>
    unseenCards(s, hand).filter((c) => !c.joker && c.suit === suit).length;
  // A high joker makes others burn their best card of the suit: pick one I hold least of.
  // A low joker only works when others follow the suit: pick the one most still out.
  const score = (suit: Suit) =>
    mode === "high" ? -count(suit) * 2 + unseen(suit) : unseen(suit);
  return SUITS.reduce((a, b) => (score(b) > score(a) ? b : a));
}

export function botPlay(s: GameState, player: number): PlayOption {
  const hand = s.hands[player];
  let options = legalPlays(s, player);
  if (s.trick.length === 0) {
    // Jokers lead with a heuristically chosen suit instead of all four.
    options = options.filter(
      (o) => !o.card.joker || o.suit === pickSuit(s, hand, o.mode ?? "high"),
    );
  }
  if (options.length === 1) return options[0];

  const left = hand.length;
  const need = (s.bids[player] as number) - s.taken[player];
  const wantWin = need !== 0;
  const scored = options.map((opt) => ({
    opt,
    p: winChance(s, player, opt),
    cost: cost(s, opt.card),
  }));

  if (wantWin) {
    // Keep the joker back while there is room to lose tricks.
    const slack = left - need;
    const usable = scored.filter(
      (o) => o.p >= 0.6 && (!o.opt.card.joker || slack < 2),
    );
    if (usable.length > 0) {
      return usable.reduce((a, b) => (b.cost < a.cost ? b : a)).opt;
    }
    const nonJoker = scored.filter((o) => !o.opt.card.joker);
    const pool = nonJoker.length > 0 ? nonJoker : scored;
    const best = pool.reduce((a, b) => (b.p > a.p ? b : a));
    if (best.p >= 0.3) return best.opt;
    return pool.reduce((a, b) => (b.cost < a.cost ? b : a)).opt;
  }

  // Want to lose: shed the most dangerous card that is still safe.
  const safe = scored.filter((o) => o.p <= 0.3 && !o.opt.card.joker);
  if (safe.length > 0) {
    const danger = (o: (typeof scored)[number]) => o.cost - (o.p > 0.1 ? 20 : 0);
    return safe.reduce((a, b) => (danger(b) > danger(a) ? b : a)).opt;
  }
  const lowJokers = scored.filter(
    (o) => o.opt.card.joker && o.opt.mode === "low" && o.p <= 0.3,
  );
  if (lowJokers.length > 0) return lowJokers[0].opt;
  return scored.reduce((a, b) =>
    b.p < a.p || (b.p === a.p && b.cost < a.cost) ? b : a,
  ).opt;
}
