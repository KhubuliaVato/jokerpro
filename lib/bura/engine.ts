import { shuffle, SUITS, type NormalCard, type Rank, type Rng, type Suit } from "../joker/cards";

/**
 * Bura: 36 cards (6 to ace), three in each hand, the card turned up under the deck sets the trump.
 * The leader plays one to three cards of one suit; each player after them answers with the same number of cards
 * and has to beat what is on the table if they can. The best answer takes every card of the trick.
 * A round is won with 61 of the 120 points; the match goes to TARGET game points.
 * Two players play each for themselves, four play in two teams (seats 0 and 2 against seats 1 and 3).
 */
export type BuraPlayers = 2 | 4;

export const HAND = 3;
export const TARGET = 12;
/** Game points of a "bura": three trumps in the hand. */
export const BURA_GAIN = 4;

export const teamOf = (player: number) => player % 2;

export const cardPoints = (rank: number): number =>
  rank === 14 ? 11 : rank === 10 ? 10 : rank === 13 ? 4 : rank === 12 ? 3 : rank === 11 ? 2 : 0;

export const sumPoints = (cards: NormalCard[]) => cards.reduce((n, c) => n + cardPoints(c.rank), 0);

export function buildDeck(): NormalCard[] {
  const deck: NormalCard[] = [];
  for (const suit of SUITS) {
    for (let rank = 6; rank <= 14; rank++) deck.push({ joker: false, suit, rank: rank as Rank, id: `${suit}${rank}` });
  }
  return deck;
}

export interface Play {
  player: number;
  cards: NormalCard[];
}

export interface RoundResult {
  /** Winning team, or null for 60:60. */
  winner: number | null;
  /** Game points the winner got. */
  gain: number;
  /** Points each team took in the round. */
  piles: number[];
  /** The player who showed three trumps, if the round ended that way. */
  bura: number | null;
}

export type Phase = "play" | "trickEnd" | "roundEnd" | "gameEnd";

export interface BuraState {
  players: BuraPlayers;
  target: number;
  phase: Phase;
  round: number;
  dealer: number;
  /** The draw pile, the next card first; the trump card lies at the bottom until it is drawn. */
  deck: NormalCard[];
  trumpCard: NormalCard;
  trump: Suit;
  hands: NormalCard[][];
  leader: number;
  turn: number;
  trick: Play[];
  /** Index in `trick` of the play that is winning so far. */
  best: number;
  /** Cards of all finished tricks of this round (what has been seen). */
  seen: NormalCard[];
  /** Points and tricks per team in this round. */
  piles: number[];
  tricks: number[];
  /** Game points per team. */
  scores: number[];
  last: { plays: Play[]; winner: number } | null;
  result: RoundResult | null;
}

/** Does `a` beat `b`: higher in the suit of `b`, or a trump over anything else. */
export function beats(a: NormalCard, b: NormalCard, trump: Suit): boolean {
  if (a.suit === b.suit) return a.rank > b.rank;
  return a.suit === trump;
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]));
}

/** Does the answer beat every card of `base`, each answer card against a different one? */
export function beatsCombo(answer: NormalCard[], base: NormalCard[], trump: Suit): boolean {
  if (answer.length !== base.length) return false;
  return permutations(base).some((order) => answer.every((c, i) => beats(c, order[i], trump)));
}

/** Every way of choosing `n` of the cards. */
export function combinations<T>(items: T[], n: number): T[][] {
  if (n === 0) return [[]];
  if (items.length < n) return [];
  const [first, ...rest] = items;
  return [...combinations(rest, n - 1).map((c) => [first, ...c]), ...combinations(rest, n)];
}

/** What the player on turn may play: one to three cards of a suit when leading, an answer of the same size otherwise. */
export function legalPlays(s: BuraState, player = s.turn): NormalCard[][] {
  if (s.phase !== "play" || player !== s.turn) return [];
  const hand = s.hands[player];
  if (s.trick.length === 0) {
    const out: NormalCard[][] = [];
    for (const suit of SUITS) {
      const ofSuit = hand.filter((c) => c.suit === suit);
      for (let n = 1; n <= Math.min(HAND, ofSuit.length); n++) out.push(...combinations(ofSuit, n));
    }
    return out;
  }
  const lead = s.trick[0].cards.length;
  const all = combinations(hand, lead);
  const top = s.trick[s.best];
  // A partner who is winning needs no help; anybody else has to beat what is on the table if possible.
  if (teamOf(top.player) === teamOf(player) && top.player !== player) return all;
  const beating = all.filter((c) => beatsCombo(c, top.cards, s.trump));
  return beating.length > 0 ? beating : all;
}

const sameCards = (a: NormalCard[], ids: string[]) => a.length === ids.length && a.every((c) => ids.includes(c.id));

export function isLegal(s: BuraState, ids: string[], player = s.turn): boolean {
  return legalPlays(s, player).some((p) => sameCards(p, ids));
}

export function createGame(players: BuraPlayers, rng: Rng = Math.random, target = TARGET): BuraState {
  const first = deal(
    {
      players,
      target,
      phase: "play",
      round: 0,
      dealer: Math.floor(rng() * players),
      deck: [],
      trumpCard: buildDeck()[0],
      trump: "S",
      hands: [],
      leader: 0,
      turn: 0,
      trick: [],
      best: -1,
      seen: [],
      piles: [0, 0],
      tricks: [0, 0],
      scores: [0, 0],
      last: null,
      result: null,
    },
    rng,
  );
  return first;
}

/** Deals a round: three cards each, the next card turned up for the trump and slid under the pile. */
function deal(s: BuraState, rng: Rng): BuraState {
  const next = structuredClone(s);
  const cards = shuffle(buildDeck(), rng);
  next.hands = Array.from({ length: next.players }, (_, p) => cards.slice(p * HAND, p * HAND + HAND));
  const rest = cards.slice(next.players * HAND);
  next.trumpCard = rest[0];
  next.trump = rest[0].suit;
  next.deck = [...rest.slice(1), rest[0]];
  next.leader = next.turn = (next.dealer + 1) % next.players;
  next.trick = [];
  next.best = -1;
  next.seen = [];
  next.piles = [0, 0];
  next.tricks = [0, 0];
  next.last = null;
  next.result = null;
  next.phase = "play";
  return checkBura(next);
}

/** Three trumps in a hand win the round at once. */
function checkBura(s: BuraState): BuraState {
  for (let k = 0; k < s.players; k++) {
    const p = (s.leader + k) % s.players;
    const hand = s.hands[p];
    if (hand.length === HAND && hand.every((c) => c.suit === s.trump)) return endRound(s, p);
  }
  return s;
}

function endRound(s: BuraState, bura: number | null): BuraState {
  const piles = s.piles.slice();
  let winner: number | null = null;
  let gain = 0;
  if (bura !== null) {
    winner = teamOf(bura);
    gain = BURA_GAIN;
  } else if (piles[0] !== piles[1]) {
    winner = piles[0] > piles[1] ? 0 : 1;
    const loser = 1 - winner;
    gain = s.tricks[loser] === 0 ? 3 : piles[loser] < 31 ? 2 : 1;
  }
  const next = { ...s, piles, scores: s.scores.slice() };
  if (winner !== null) next.scores[winner] += gain;
  next.result = { winner, gain, piles, bura };
  next.phase = next.scores.some((v) => v >= next.target) ? "gameEnd" : "roundEnd";
  return next;
}

/** The player on turn puts down the cards (ids), or throws if that is not allowed. */
export function playCards(s: BuraState, ids: string[]): BuraState {
  if (s.phase !== "play") throw new Error("not playing");
  if (!isLegal(s, ids)) throw new Error("illegal play");
  const next = structuredClone(s);
  const cards = next.hands[next.turn].filter((c) => ids.includes(c.id));
  next.hands[next.turn] = next.hands[next.turn].filter((c) => !ids.includes(c.id));
  next.trick.push({ player: next.turn, cards });
  const at = next.trick.length - 1;
  if (at === 0 || beatsCombo(cards, next.trick[next.best].cards, next.trump)) next.best = at;
  if (next.trick.length === next.players) next.phase = "trickEnd";
  else next.turn = (next.turn + 1) % next.players;
  return next;
}

/** The finished trick goes to its winner, everybody draws, and the winner leads. */
export function finishTrick(s: BuraState): BuraState {
  if (s.phase !== "trickEnd") throw new Error("no finished trick");
  const next = structuredClone(s);
  const winner = next.trick[next.best].player;
  const taken = next.trick.flatMap((p) => p.cards);
  const team = teamOf(winner);
  next.piles[team] += sumPoints(taken);
  next.tricks[team] += 1;
  next.seen.push(...taken);
  next.last = { plays: next.trick, winner };
  next.trick = [];
  next.best = -1;
  // Cards are drawn one at a time round the table, starting with the winner.
  let drawing = true;
  while (drawing && next.deck.length > 0) {
    drawing = false;
    for (let k = 0; k < next.players && next.deck.length > 0; k++) {
      const p = (winner + k) % next.players;
      if (next.hands[p].length < HAND) {
        next.hands[p].push(next.deck.shift()!);
        drawing = true;
      }
    }
  }
  next.leader = next.turn = winner;
  next.phase = "play";
  if (next.hands.every((h) => h.length === 0)) return endRound(next, null);
  return checkBura(next);
}

/** After a round: the next deal (the dealer changes every round). */
export function nextRound(s: BuraState, rng: Rng = Math.random): BuraState {
  if (s.phase !== "roundEnd") throw new Error("round is not finished");
  const next = structuredClone(s);
  next.round += 1;
  next.dealer = (next.dealer + 1) % next.players;
  return deal(next, rng);
}

/** The cards a player cannot see in other hands or the pile (their own hand and what was played are known). */
export function unseenCards(s: BuraState, player: number): NormalCard[] {
  const known = new Set<string>([
    ...s.hands[player].map((c) => c.id),
    ...s.seen.map((c) => c.id),
    ...s.trick.flatMap((p) => p.cards.map((c) => c.id)),
  ]);
  // The trump card lies face up at the bottom of the pile for as long as the pile lasts.
  if (s.deck.length > 0) known.add(s.trumpCard.id);
  return buildDeck().filter((c) => !known.has(c.id));
}
