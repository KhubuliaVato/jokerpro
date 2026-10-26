import {
  buildDeck,
  shuffle,
  SUITS,
  type Card,
  type Rng,
  type Suit,
} from "./cards";
import { handPoints, schedule, type Rules } from "./rules";

export const PLAYERS = 4;

export type JokerMode = "high" | "low";

/** A card on the table. A joker also carries its mode and, when it leads, the named suit. */
export interface Play {
  player: number;
  card: Card;
  mode?: JokerMode;
  suit?: Suit;
}

export type PlayOption = Omit<Play, "player">;

export type Phase =
  | "trump"
  | "bidding"
  | "playing"
  | "trickEnd"
  | "handEnd"
  | "gameEnd";

export interface HandRecord {
  pulka: number;
  cards: number;
  trump: Suit | null;
  bids: number[];
  taken: number[];
  points: number[];
}

export interface GameState {
  rules: Rules;
  phase: Phase;
  handIndex: number;
  dealer: number;
  /** Cards per player in the current hand. */
  cards: number;
  hands: Card[][];
  /** Nine-card hands: the last six cards, dealt once trump is named. */
  rest: Card[][];
  trump: Suit | null;
  /** Face-up card that decided trump (hands of 1-8 cards). */
  trumpCard: Card | null;
  bids: (number | null)[];
  taken: number[];
  turn: number;
  trick: Play[];
  trickWinner: number | null;
  /** The trick that was collected last, for a look back. */
  lastTrick: { plays: Play[]; winner: number } | null;
  /** Every card played so far in this hand, including the current trick. */
  played: Card[];
  history: HandRecord[];
  /** Pulka premium per pulka index, per player. */
  premiums: number[][];
}

const next = (p: number) => (p + 1) % PLAYERS;

export function totalHands(rules: Rules): number {
  return schedule(rules.format).reduce((n, p) => n + p.length, 0);
}

/** Pulka index and the hand's position inside it. */
export function locateHand(rules: Rules, handIndex: number) {
  const pulkas = schedule(rules.format);
  let left = handIndex;
  for (let pulka = 0; pulka < pulkas.length; pulka++) {
    if (left < pulkas[pulka].length) {
      return {
        pulka,
        inPulka: left,
        pulkaLength: pulkas[pulka].length,
        cards: pulkas[pulka][left],
      };
    }
    left -= pulkas[pulka].length;
  }
  throw new Error("hand index out of range");
}

export function createGame(rules: Rules, rng: Rng = Math.random): GameState {
  const state: GameState = {
    rules,
    phase: "bidding",
    handIndex: 0,
    dealer: Math.floor(rng() * PLAYERS),
    cards: 0,
    hands: [],
    rest: [],
    trump: null,
    trumpCard: null,
    bids: [],
    taken: [],
    turn: 0,
    trick: [],
    trickWinner: null,
    lastTrick: null,
    played: [],
    history: [],
    premiums: schedule(rules.format).map(() => Array(PLAYERS).fill(0)),
  };
  return deal(state, rng);
}

function deal(prev: GameState, rng: Rng): GameState {
  const s = structuredClone(prev);
  const { cards } = locateHand(s.rules, s.handIndex);
  const deck = shuffle(buildDeck(), rng);
  s.cards = cards;
  s.bids = Array(PLAYERS).fill(null);
  s.taken = Array(PLAYERS).fill(0);
  s.trick = [];
  s.trickWinner = null;
  s.lastTrick = null;
  s.played = [];
  s.trumpCard = null;
  s.turn = next(s.dealer);

  if (cards === 9) {
    // Three cards first; trump is named on those, the other six follow.
    s.hands = [0, 1, 2, 3].map((p) => deck.slice(p * 3, p * 3 + 3));
    s.rest = [0, 1, 2, 3].map((p) => deck.slice(12 + p * 6, 12 + p * 6 + 6));
    s.trump = null;
    s.phase = "trump";
  } else {
    s.hands = [0, 1, 2, 3].map((p) => deck.slice(p * cards, p * cards + cards));
    s.rest = [];
    const up = deck[PLAYERS * cards];
    s.trumpCard = up;
    s.trump = up.joker ? null : up.suit;
    s.phase = "bidding";
  }
  return s;
}

/** `null` names no-trump ("bez"). */
export function chooseTrump(prev: GameState, trump: Suit | null): GameState {
  if (prev.phase !== "trump") throw new Error("not choosing trump");
  const s = structuredClone(prev);
  s.trump = trump;
  s.hands = s.hands.map((h, p) => [...h, ...s.rest[p]]);
  s.rest = [];
  s.phase = "bidding";
  s.turn = next(s.dealer);
  return s;
}

export function legalBids(s: GameState, player: number): number[] {
  const all = Array.from({ length: s.cards + 1 }, (_, i) => i);
  if (player !== s.dealer) return all;
  // The dealer bids last and may not make the bids add up to the card count.
  const sum = s.bids.reduce<number>((a, b) => a + (b ?? 0), 0);
  return all.filter((b) => sum + b !== s.cards);
}

export function placeBid(prev: GameState, bid: number): GameState {
  if (prev.phase !== "bidding") throw new Error("not bidding");
  if (!legalBids(prev, prev.turn).includes(bid)) throw new Error("illegal bid");
  const s = structuredClone(prev);
  s.bids[s.turn] = bid;
  if (s.bids.every((b) => b !== null)) {
    s.phase = "playing";
    s.turn = next(s.dealer);
  } else {
    s.turn = next(s.turn);
  }
  return s;
}

const ledSuit = (lead: Play): Suit =>
  lead.card.joker ? (lead.suit as Suit) : lead.card.suit;

export function legalPlays(s: GameState, player: number): PlayOption[] {
  const hand = s.hands[player];
  const jokers = hand.filter((c) => c.joker);
  const options: PlayOption[] = [];
  const addJokers = (suits: (Suit | undefined)[]) => {
    for (const card of jokers) {
      for (const mode of ["high", "low"] as const) {
        for (const suit of suits) options.push({ card, mode, suit });
      }
    }
  };

  if (s.trick.length === 0) {
    for (const card of hand) if (!card.joker) options.push({ card });
    addJokers(SUITS);
    return options;
  }

  const lead = s.trick[0];
  const suit = ledSuit(lead);
  const normal = hand.filter((c) => !c.joker);
  const suited = normal.filter((c) => c.suit === suit);
  let allowed: Card[];
  if (suited.length > 0) {
    if (lead.card.joker && lead.mode === "high") {
      // After a high joker lead the suit must be answered with its highest card.
      const top = suited.reduce((a, b) => (b.rank > a.rank ? b : a));
      allowed = [top];
    } else {
      allowed = suited;
    }
  } else {
    const trumps = s.trump ? normal.filter((c) => c.suit === s.trump) : [];
    allowed = trumps.length > 0 ? trumps : normal;
  }
  for (const card of allowed) options.push({ card });
  addJokers([undefined]);
  return options;
}

/** Who takes a trick. */
export function trickWinner(plays: Play[], trump: Suit | null): number {
  let high = -1;
  plays.forEach((p, i) => {
    if (p.card.joker && p.mode === "high") high = i;
  });
  if (high >= 0) return plays[high].player;

  const suit = ledSuit(plays[0]);
  const beats = (best: Play | null, p: Play, target: Suit) =>
    !p.card.joker &&
    p.card.suit === target &&
    (!best || (!best.card.joker && p.card.rank > best.card.rank));

  let bestTrump: Play | null = null;
  let bestLed: Play | null = null;
  for (const p of plays) {
    if (trump && beats(bestTrump, p, trump)) bestTrump = p;
    if (beats(bestLed, p, suit)) bestLed = p;
  }
  // A low joker lead with nobody following the suit leaves the trick to the leader.
  return (bestTrump ?? bestLed ?? plays[0]).player;
}

export function playCard(prev: GameState, option: PlayOption): GameState {
  if (prev.phase !== "playing") throw new Error("not playing");
  const legal = legalPlays(prev, prev.turn).some(
    (o) =>
      o.card.id === option.card.id &&
      o.mode === option.mode &&
      o.suit === option.suit,
  );
  if (!legal) throw new Error("illegal play");
  const s = structuredClone(prev);
  const play: Play = { player: s.turn, ...option };
  s.hands[s.turn] = s.hands[s.turn].filter((c) => c.id !== option.card.id);
  s.trick.push(play);
  s.played.push(option.card);
  if (s.trick.length === PLAYERS) {
    s.trickWinner = trickWinner(s.trick, s.trump);
    s.phase = "trickEnd";
  } else {
    s.turn = next(s.turn);
  }
  return s;
}

/** Collect the finished trick and move on (possibly closing the hand). */
export function finishTrick(prev: GameState): GameState {
  if (prev.phase !== "trickEnd" || prev.trickWinner === null) {
    throw new Error("no finished trick");
  }
  const s = structuredClone(prev);
  const winner = s.trickWinner as number;
  s.taken[winner] += 1;
  s.lastTrick = { plays: s.trick, winner };
  s.trick = [];
  s.trickWinner = null;
  s.turn = winner;
  if (s.hands[0].length > 0) {
    s.phase = "playing";
    return s;
  }
  return closeHand(s);
}

function closeHand(s: GameState): GameState {
  const { pulka, inPulka, pulkaLength } = locateHand(s.rules, s.handIndex);
  const bids = s.bids as number[];
  s.history.push({
    pulka,
    cards: s.cards,
    trump: s.trump,
    bids: bids.slice(),
    taken: s.taken.slice(),
    points: bids.map((b, p) => handPoints(b, s.taken[p], s.cards, s.rules)),
  });

  if (inPulka === pulkaLength - 1 && s.rules.pulkaPremium) {
    const rows = s.history.filter((h) => h.pulka === pulka);
    for (let p = 0; p < PLAYERS; p++) {
      if (rows.every((h) => h.bids[p] === h.taken[p])) {
        s.premiums[pulka][p] = Math.max(...rows.map((h) => h.points[p]));
      }
    }
  }
  s.phase = s.handIndex + 1 >= totalHands(s.rules) ? "gameEnd" : "handEnd";
  return s;
}

export function nextHand(prev: GameState, rng: Rng = Math.random): GameState {
  if (prev.phase !== "handEnd") throw new Error("hand is not finished");
  const s = structuredClone(prev);
  s.handIndex += 1;
  s.dealer = next(s.dealer);
  return deal(s, rng);
}

export function totals(s: GameState): number[] {
  const sums = Array(PLAYERS).fill(0) as number[];
  for (const h of s.history) h.points.forEach((pt, p) => (sums[p] += pt));
  for (const row of s.premiums) row.forEach((pt, p) => (sums[p] += pt));
  return sums;
}
