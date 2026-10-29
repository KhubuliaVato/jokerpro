import { shuffle, SUITS, type NormalCard, type Rng } from "../joker/cards";
import { bestHand, compareHands, type HandValue } from "./eval";

/** No-limit Texas Hold'em with play chips. */
export interface PokerConfig {
  smallBlind: number;
  bigBlind: number;
  startStack: number;
  /** 2 to 6 at the table. */
  players: number;
}

export const DEFAULT_CONFIG: PokerConfig = { smallBlind: 10, bigBlind: 20, startStack: 1000, players: 6 };

export const HUMAN = 0;

export interface Seat {
  stack: number;
  /** The two private cards. */
  hole: NormalCard[];
  folded: boolean;
  allIn: boolean;
  /** Out of the game: no chips left. */
  out: boolean;
  /** Put in during the current betting round. */
  bet: number;
  /** Put in during the whole hand (blinds included): decides the pots. */
  invested: number;
  /** Acted since the last full raise of this round. */
  acted: boolean;
  /** A short all-in raise came after this player acted: he may call or fold but not raise again. */
  locked: boolean;
  /** What the player did last: "check" | "call" | "bet" | "raise" | "fold" | "allin" | "sb" | "bb" | null. */
  last: string | null;
}

export type Phase =
  /** `turn` has to act. */
  | "betting"
  /** The hand is decided; `result` says who won what. `nextHand` deals the next one. */
  | "handEnd"
  /** Somebody ran out of chips (the human), or only one player has chips left. */
  | "gameEnd";

/** 0 pre-flop, 1 flop, 2 turn, 3 river. */
export type Street = 0 | 1 | 2 | 3;
export const STREET_NAME = ["პრეფლოპი", "ფლოპი", "ტერნი", "რივერი"] as const;

export interface Payout {
  seat: number;
  amount: number;
  /** The winning hand and its five cards, when shown down. */
  value: HandValue | null;
  best: string[];
}

export interface HandResult {
  payouts: Payout[];
  /** More than one player was left to show their cards. */
  showdown: boolean;
  /** Seats whose hole cards are turned face up. */
  revealed: number[];
  values: (HandValue | null)[];
}

export interface PokerState {
  config: PokerConfig;
  seats: Seat[];
  deck: NormalCard[];
  /** The five community cards as dealt so far. */
  community: NormalCard[];
  dealer: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  phase: Phase;
  street: Street;
  /** The highest amount any player has put in this round. */
  currentBet: number;
  /** The size of the last full raise (the least a new raise must add). */
  minRaise: number;
  turn: number;
  handNo: number;
  result: HandResult | null;
  /** Set when the game is over: the seat that has all the chips, or null when the human went broke. */
  winner: number | null;
}

export type PokerAction =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  /** Raise (or bet) so that the player's total this round becomes `to`. */
  | { type: "raise"; to: number };

// ---------------------------------------------------------------------------------------------------------------------

const count = (s: PokerState) => s.seats.length;
const left = (s: PokerState, seat: number) => (seat + 1) % count(s);

export const inHand = (seat: Seat) => !seat.out && !seat.folded;
export const potOf = (s: PokerState) => s.seats.reduce((sum, p) => sum + p.invested, 0);

export function fullDeck(): NormalCard[] {
  const deck: NormalCard[] = [];
  for (const suit of SUITS) for (let rank = 2; rank <= 14; rank++) deck.push({ joker: false, suit, rank: rank as NormalCard["rank"], id: `${suit}${rank}` });
  return deck;
}

function clone(s: PokerState): PokerState {
  return {
    ...s,
    seats: s.seats.map((p) => ({ ...p, hole: p.hole.slice() })),
    deck: s.deck.slice(),
    community: s.community.slice(),
  };
}

/** Seats still in the hand, starting with the one to the left of `from`. */
function fromLeftOf(s: PokerState, from: number): number[] {
  const out: number[] = [];
  for (let k = 1; k <= count(s); k++) {
    const seat = (from + k) % count(s);
    if (inHand(s.seats[seat])) out.push(seat);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// the deal

export function createGame(config: PokerConfig = DEFAULT_CONFIG, rng: Rng = Math.random): PokerState {
  const seats: Seat[] = Array.from({ length: config.players }, () => ({
    stack: config.startStack,
    hole: [],
    folded: false,
    allIn: false,
    out: false,
    bet: 0,
    invested: 0,
    acted: false,
    locked: false,
    last: null,
  }));
  const state: PokerState = {
    config,
    seats,
    deck: [],
    community: [],
    dealer: Math.floor(rng() * config.players),
    smallBlindSeat: 0,
    bigBlindSeat: 0,
    phase: "betting",
    street: 0,
    currentBet: 0,
    minRaise: config.bigBlind,
    turn: 0,
    handNo: 0,
    result: null,
    winner: null,
  };
  return dealHand(state, rng);
}

function postBlind(p: Seat, amount: number, label: string) {
  const put = Math.min(p.stack, amount);
  p.stack -= put;
  p.bet += put;
  p.invested += put;
  if (p.stack === 0) p.allIn = true;
  p.last = label;
}

/** Shuffle, blinds, two cards each; the pre-flop betting begins. */
function dealHand(prev: PokerState, rng: Rng): PokerState {
  const s = clone(prev);
  s.handNo += 1;
  s.deck = shuffle(fullDeck(), rng);
  s.community = [];
  s.street = 0;
  s.result = null;
  s.phase = "betting";
  for (const p of s.seats) {
    p.hole = [];
    p.folded = p.out;
    p.allIn = false;
    p.bet = 0;
    p.invested = 0;
    p.acted = false;
    p.locked = false;
    p.last = null;
  }
  for (let k = 0; k < 2; k++) for (const seat of fromLeftOf(s, s.dealer)) s.seats[seat].hole.push(s.deck.shift()!);

  const live = fromLeftOf(s, s.dealer); // seats in the hand, from the dealer's left
  // Heads up the dealer posts the small blind and acts first; otherwise the two seats after the dealer post.
  const headsUp = live.length === 2;
  const sb = headsUp ? s.dealer : live[0];
  const bb = headsUp ? live[0] : live[1];
  s.smallBlindSeat = sb;
  s.bigBlindSeat = bb;
  postBlind(s.seats[sb], s.config.smallBlind, "sb");
  postBlind(s.seats[bb], s.config.bigBlind, "bb");
  s.currentBet = Math.max(s.seats[sb].bet, s.seats[bb].bet);
  s.minRaise = s.config.bigBlind;
  // First to act: heads up the dealer, otherwise the seat after the big blind.
  s.turn = headsUp ? sb : fromLeftOf(s, bb)[0];
  return settle(s, rng);
}

// ---------------------------------------------------------------------------------------------------------------------
// what the player to act may do

export interface Options {
  toCall: number;
  /** What a call really costs: all the stack when it is short. */
  callCost: number;
  canCheck: boolean;
  canRaise: boolean;
  /** The least a raise may make the player's total this round (or all the stack, when shorter). */
  minRaiseTo: number;
  /** All the chips: the most the total may become. */
  maxRaiseTo: number;
  /** No bet yet in this round: a "bet", not a "raise". */
  opening: boolean;
}

export function optionsFor(s: PokerState, seat = s.turn): Options {
  const p = s.seats[seat];
  const toCall = Math.max(0, s.currentBet - p.bet);
  const maxRaiseTo = p.bet + p.stack;
  const full = s.currentBet + s.minRaise;
  return {
    toCall,
    callCost: Math.min(toCall, p.stack),
    canCheck: toCall === 0,
    canRaise: !p.locked && !p.allIn && p.stack > toCall,
    minRaiseTo: Math.min(full, maxRaiseTo),
    maxRaiseTo,
    opening: s.currentBet === 0,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// moving on

const needsToAct = (s: PokerState, seat: number) => {
  const p = s.seats[seat];
  return inHand(p) && !p.allIn && (!p.acted || p.bet < s.currentBet);
};

/** Finds the next player who must act, or closes the round (and the hand) when nobody has to. */
function settle(s: PokerState, rng: Rng): PokerState {
  const alive = s.seats.map((p, i) => (inHand(p) ? i : -1)).filter((i) => i >= 0);
  if (alive.length === 1) return finishByFolds(s, alive[0]);

  // Everybody else all in: the one player with chips left has nobody to bet against once he has matched.
  const canAct = alive.filter((i) => !s.seats[i].allIn);
  if (canAct.length === 0 || (canAct.length === 1 && s.seats[canAct[0]].bet >= s.currentBet)) return endRound(s, rng);

  for (let k = 0; k < count(s); k++) {
    const seat = (s.turn + k) % count(s);
    if (needsToAct(s, seat)) {
      s.turn = seat;
      s.phase = "betting";
      return s;
    }
  }
  return endRound(s, rng);
}

function endRound(s: PokerState, rng: Rng): PokerState {
  for (const p of s.seats) {
    p.bet = 0;
    p.acted = false;
    p.locked = false;
    if (p.last !== "fold") p.last = null;
  }
  s.currentBet = 0;
  s.minRaise = s.config.bigBlind;
  if (s.street === 3) return showdown(s);

  s.street = (s.street + 1) as Street;
  const deal = s.street === 1 ? 3 : 1;
  for (let k = 0; k < deal; k++) s.community.push(s.deck.shift()!);
  s.turn = fromLeftOf(s, s.dealer)[0];
  return settle(s, rng);
}

function finishByFolds(s: PokerState, winner: number): PokerState {
  const total = potOf(s);
  s.seats[winner].stack += total;
  s.phase = "handEnd";
  s.result = {
    payouts: [{ seat: winner, amount: total, value: null, best: [] }],
    showdown: false,
    revealed: [],
    values: s.seats.map(() => null),
  };
  for (const p of s.seats) {
    p.bet = 0;
    p.acted = false;
  }
  s.currentBet = 0;
  return s;
}

/**
 * The cards are shown. Chips are paid out pot by pot: the main pot and the side pots of players who were all in
 * for less than the others. A pot only goes to players who put into it; a tie splits it, the odd chip going to the
 * winner closest to the dealer's left.
 */
function showdown(s: PokerState): PokerState {
  const hands = s.seats.map((p) => (inHand(p) ? bestHand([...p.hole, ...s.community]) : null));
  const values = hands.map((h) => h?.value ?? null);
  const levels = [...new Set(s.seats.filter((p) => p.invested > 0).map((p) => p.invested))].sort((a, b) => a - b);
  const won = new Map<number, number>();
  let previous = 0;
  for (const level of levels) {
    const layer = s.seats.reduce((sum, p) => sum + Math.max(0, Math.min(p.invested, level) - previous), 0);
    let contenders = s.seats.map((_, i) => i).filter((i) => inHand(s.seats[i]) && s.seats[i].invested >= level);
    previous = level;
    if (layer === 0) continue;
    // Cannot normally happen; no chip may vanish all the same.
    if (contenders.length === 0) contenders = s.seats.map((_, i) => i).filter((i) => inHand(s.seats[i]));
    let best: HandValue | null = null;
    let winners: number[] = [];
    for (const i of contenders) {
      const v = values[i]!;
      const c = best ? compareHands(v, best) : 1;
      if (c > 0) {
        best = v;
        winners = [i];
      } else if (c === 0) winners.push(i);
    }
    const order = fromLeftOf(s, s.dealer).filter((i) => winners.includes(i));
    const share = Math.floor(layer / order.length);
    let extra = layer - share * order.length;
    for (const i of order) {
      const amount = share + (extra > 0 ? 1 : 0);
      if (extra > 0) extra -= 1;
      won.set(i, (won.get(i) ?? 0) + amount);
    }
  }
  const payouts: Payout[] = [...won.entries()].map(([seat, amount]) => ({
    seat,
    amount,
    value: values[seat],
    best: hands[seat]?.cards.map((c) => c.id) ?? [],
  }));
  for (const { seat, amount } of payouts) s.seats[seat].stack += amount;
  s.phase = "handEnd";
  s.result = {
    payouts,
    showdown: true,
    revealed: s.seats.map((p, i) => (inHand(p) ? i : -1)).filter((i) => i >= 0),
    values,
  };
  return s;
}

// ---------------------------------------------------------------------------------------------------------------------
// the moves

/** Applies the action of the player to move. Throws on an illegal move. */
export function act(prev: PokerState, action: PokerAction, rng: Rng = Math.random): PokerState {
  if (prev.phase !== "betting") throw new Error("illegal: not a betting phase");
  const s = clone(prev);
  const seat = s.turn;
  const p = s.seats[seat];
  const o = optionsFor(s, seat);

  switch (action.type) {
    case "fold":
      p.folded = true;
      p.last = "fold";
      break;
    case "check":
      if (!o.canCheck) throw new Error("illegal: cannot check");
      p.acted = true;
      p.last = "check";
      break;
    case "call": {
      if (o.toCall === 0) throw new Error("illegal: nothing to call");
      p.stack -= o.callCost;
      p.bet += o.callCost;
      p.invested += o.callCost;
      p.acted = true;
      p.last = p.stack === 0 ? "allin" : "call";
      if (p.stack === 0) p.allIn = true;
      break;
    }
    case "raise": {
      const to = Math.floor(action.to);
      if (!o.canRaise) throw new Error("illegal: cannot raise");
      if (to > o.maxRaiseTo || to <= s.currentBet) throw new Error("illegal: bad amount");
      if (to < o.minRaiseTo && to !== o.maxRaiseTo) throw new Error("illegal: raise too small");
      const put = to - p.bet;
      const increment = to - s.currentBet;
      p.stack -= put;
      p.bet = to;
      p.invested += put;
      p.acted = true;
      p.last = p.stack === 0 ? "allin" : o.opening ? "bet" : "raise";
      if (p.stack === 0) p.allIn = true;
      if (increment >= s.minRaise) {
        // A full raise reopens the betting for everybody.
        s.minRaise = increment;
        for (const q of s.seats) if (q !== p) {
          q.acted = false;
          q.locked = false;
        }
      } else {
        // A short all-in: those who already acted may call it or fold, but not raise again.
        for (const q of s.seats) if (q !== p && q.acted) q.locked = true;
      }
      s.currentBet = to;
      break;
    }
    default:
      throw new Error("illegal: unknown action");
  }

  s.turn = left(s, seat);
  return settle(s, rng);
}

/**
 * After a hand ends: removes the broke, moves the button, and deals again (or ends the game).
 * Against bots (`solo`) the game is over when the human is broke; at an online table it goes on until one player has all the chips.
 */
export function nextHand(prev: PokerState, rng: Rng = Math.random, solo = true): PokerState {
  if (prev.phase !== "handEnd") return prev;
  const s = clone(prev);
  for (const p of s.seats) if (p.stack === 0) p.out = true;
  const alive = s.seats.map((p, i) => (p.out ? -1 : i)).filter((i) => i >= 0);
  if ((solo && s.seats[HUMAN].out) || alive.length <= 1) {
    s.phase = "gameEnd";
    s.winner = solo && s.seats[HUMAN].out ? null : (alive[0] ?? null);
    return s;
  }
  let d = left(s, s.dealer);
  while (s.seats[d].out) d = left(s, d);
  s.dealer = d;
  return dealHand(s, rng);
}
