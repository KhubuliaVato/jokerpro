import { shuffle, SUITS, type NormalCard, type Rank, type Rng, type Suit } from "../joker/cards";

/**
 * Bura (the rules of parabura.ge). Four players play in two teams (seats 0 and 2 against seats 1 and 3) with
 * 36 cards (6 to ace) and five cards in a hand; two players play "three-card" Bura with the 20 cards from ten to
 * ace and three cards each. The card turned up under the pile sets the trump.
 * The leader plays one to HAND cards of one suit; each player after them answers with the same number of cards,
 * any cards they like. An answer that beats every led card (each one by a different card: higher in its suit, or a
 * trump) takes the lead of the trick and is shown; any other answer is thrown down face down and stays secret.
 * The best answer takes every card of the trick, the ones thrown down included.
 * A "molotka" is a whole hand of one suit put down at once: in the three-card game on any lead, in the five-card
 * game over a single card of an opponent when every card of the hand beats it. The players who are short of the
 * number of cards then have to add to theirs, and the molotka stands unless their cards beat it card by card.
 * A round is won with 61 of the 120 points (60:60 counts for nobody); it is worth `price` game points
 * and the match goes to `target` points.
 * In the three-card game whoever wins a trick may say "var": with 31 or more points in their team's pile the
 * round is theirs at once, with fewer it goes to the others.
 * On their own turn a player may call "davi" (the round is worth 2), "se" (3) ... up to "shashi" (6); the other
 * side accepts, raises or gives in, and giving in hands the caller the price from before.
 */
export type BuraPlayers = 2 | 4;

/** Cards in a hand: five for the team game, three for two players. */
export const handSize = (players: BuraPlayers) => (players === 4 ? 5 : 3);
export const TARGET = 11;
/** What a round is worth before anybody calls (davi, se ...). */
export const BASE_PRICE = 1;

export const teamOf = (player: number) => player % 2;

export const cardPoints = (rank: number): number =>
  rank === 14 ? 11 : rank === 10 ? 10 : rank === 13 ? 4 : rank === 12 ? 3 : rank === 11 ? 2 : 0;

export const sumPoints = (cards: NormalCard[]) => cards.reduce((n, c) => n + cardPoints(c.rank), 0);

/** 36 cards for four players, the twenty from ten to ace for two. */
export function buildDeck(players: BuraPlayers = 4): NormalCard[] {
  const deck: NormalCard[] = [];
  for (const suit of SUITS) {
    for (let rank = players === 4 ? 6 : 10; rank <= 14; rank++) deck.push({ joker: false, suit, rank: rank as Rank, id: `${suit}${rank}` });
  }
  return deck;
}

export interface Play {
  player: number;
  cards: NormalCard[];
  /** Thrown down face down: it did not beat what was on the table, so only its owner knows what it is. */
  hidden: boolean;
}

export interface RoundResult {
  /** Winning team, or null for 60:60. */
  winner: number | null;
  /** Game points the winner got. */
  gain: number;
  /** Points each team took in the round. */
  piles: number[];
  /** The player who showed a hand of trumps, if the round ended that way. */
  bura: number | null;
  /** How the round ended: by the points, a bura, a "var" or a side giving in to a call. */
  how: "points" | "bura" | "var" | "fold";
  /** The player who said "var" or made the call that was given in to. */
  by: number | null;
}

/** "play": a player puts down cards; "call": a call waits for an answer; "var": the trick's winner says var or goes on. */
export type Phase = "play" | "call" | "var" | "trickEnd" | "roundEnd" | "gameEnd";

/** Points a team needs in its pile for "var" to hold. */
export const VAR_POINTS = 31;
export const MAX_PRICE = 6;
/** Calls by the price they raise the round to: 2 to 6. */
export const CALL_NAMES = ["დავი", "სე", "ჩარი", "ფანჯი", "შაში"];
export const callName = (level: number) => CALL_NAMES[level - 2] ?? "";

/** A call waiting for an answer: who made it and what the round would be worth. */
export interface Call {
  by: number;
  level: number;
}

export type BuraAction =
  | { type: "play"; ids: string[] }
  | { type: "call" }
  | { type: "answer"; answer: "accept" | "raise" | "fold" }
  | { type: "var"; say: boolean };

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
  /** Everything put down in the trick, in the order it happened (a player who adds to a molotka has two entries). */
  trick: Play[];
  /** Index in `trick` of the last entry of the player who is winning so far. */
  best: number;
  /** A molotka is on the table: the number of cards every player has to have put down. */
  mol: number | null;
  /** Cards of finished tricks that were shown (what everybody has seen). */
  seen: NormalCard[];
  /** What each player threw down face down in this round (only they know it). */
  gave: NormalCard[][];
  /** Points and tricks per team in this round. */
  piles: number[];
  tricks: number[];
  /** Points in each team's pile that the team has seen, and how many cards in it it has not (the others' secret throws). */
  known: number[];
  unknown: number[];
  /** Game points per team. */
  scores: number[];
  /** What the round is worth in game points. */
  price: number;
  /** The call that is waiting for an answer (then `turn` is the player who has to answer). */
  call: Call | null;
  /** The team whose call was the last one accepted: it cannot raise again before the others do. */
  raised: number | null;
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

/** Everything a player has put down in the trick so far. */
export const onTable = (s: BuraState, player: number): NormalCard[] => s.trick.filter((p) => p.player === player).flatMap((p) => p.cards);

/** The cards that are winning the trick so far. */
export const bestCards = (s: BuraState): NormalCard[] => (s.best < 0 ? [] : onTable(s, s.trick[s.best].player));

/** How many cards each player has to have on the table: what the leader led, or the size of a molotka. */
export const targetCount = (s: BuraState): number | null => (s.trick.length === 0 ? null : (s.mol ?? s.trick[0].cards.length));

/** How many more cards the player has to put down in this trick. */
export const needOf = (s: BuraState, player: number): number => {
  const target = targetCount(s);
  return target === null ? 0 : Math.max(0, target - onTable(s, player).length);
};

/** The next player (after the one on turn) who still has cards to put down. */
function nextToAct(s: BuraState): number | null {
  for (let k = 1; k <= s.players; k++) {
    const p = (s.turn + k) % s.players;
    if (needOf(s, p) > 0) return p;
  }
  return null;
}

/** The whole hand as a molotka, if the player may put it down now. */
export function molotka(s: BuraState, player = s.turn): NormalCard[] | null {
  if (s.phase !== "play" || player !== s.turn || s.trick.length === 0 || s.mol !== null) return null;
  const hand = s.hands[player];
  const size = handSize(s.players);
  if (hand.length !== size || onTable(s, player).length > 0) return null;
  if (!hand.every((c) => c.suit === hand[0].suit)) return null;
  // somebody has to be short of cards for it to mean anything, and everybody has to be able to match it
  if (s.trick[0].cards.length >= size) return null;
  if (s.hands.some((h, p) => h.length + onTable(s, p).length < size)) return null;
  if (s.players === 4) {
    // five-card game: only over a single card of an opponent that every card of the hand beats
    const best = bestCards(s);
    if (best.length !== 1 || s.trick[0].cards.length !== 1) return null;
    if (teamOf(s.trick[s.best].player) === teamOf(player)) return null;
    if (!hand.every((c) => beats(c, best[0], s.trump))) return null;
  }
  return hand;
}

/** What the player on turn may put down: a lead of one to HAND cards of a suit, or as many cards as they still need. */
export function legalPlays(s: BuraState, player = s.turn): NormalCard[][] {
  if (s.phase !== "play" || player !== s.turn) return [];
  const hand = s.hands[player];
  if (s.trick.length === 0) {
    const out: NormalCard[][] = [];
    // nobody may lead more cards than the shortest hand can answer
    const most = Math.min(handSize(s.players), ...s.hands.map((h) => h.length));
    for (const suit of SUITS) {
      const ofSuit = hand.filter((c) => c.suit === suit);
      for (let n = 1; n <= Math.min(most, ofSuit.length); n++) out.push(...combinations(ofSuit, n));
    }
    return out;
  }
  const need = needOf(s, player);
  if (need === 0) return [];
  const out = combinations(hand, need);
  const mol = molotka(s, player);
  if (mol && mol.length !== need) out.push(mol);
  return out;
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
      trumpCard: buildDeck(players)[0],
      trump: "S",
      hands: [],
      leader: 0,
      turn: 0,
      trick: [],
      best: -1,
      mol: null,
      seen: [],
      gave: [],
      piles: [0, 0],
      tricks: [0, 0],
      known: [0, 0],
      unknown: [0, 0],
      scores: [0, 0],
      price: BASE_PRICE,
      call: null,
      raised: null,
      last: null,
      result: null,
    },
    rng,
  );
  return first;
}

/** Deals a round: a full hand each, the next card turned up for the trump and slid under the pile. */
function deal(s: BuraState, rng: Rng): BuraState {
  const next = structuredClone(s);
  const hand = handSize(next.players);
  const cards = shuffle(buildDeck(next.players), rng);
  next.hands = Array.from({ length: next.players }, (_, p) => cards.slice(p * hand, p * hand + hand));
  const rest = cards.slice(next.players * hand);
  next.trumpCard = rest[0];
  next.trump = rest[0].suit;
  next.deck = [...rest.slice(1), rest[0]];
  next.leader = next.turn = (next.dealer + 1) % next.players;
  next.trick = [];
  next.best = -1;
  next.mol = null;
  next.seen = [];
  next.gave = Array.from({ length: next.players }, () => []);
  next.piles = [0, 0];
  next.tricks = [0, 0];
  next.known = [0, 0];
  next.unknown = [0, 0];
  next.last = null;
  next.result = null;
  next.price = BASE_PRICE;
  next.call = null;
  next.raised = null;
  next.phase = "play";
  return checkBura(next);
}

/** A full hand of trumps wins the round at once. */
function checkBura(s: BuraState): BuraState {
  for (let k = 0; k < s.players; k++) {
    const p = (s.leader + k) % s.players;
    const hand = s.hands[p];
    if (hand.length === handSize(s.players) && hand.every((c) => c.suit === s.trump)) return endRound(s, { bura: p });
  }
  return s;
}

interface Ending {
  bura?: number;
  /** A team is declared the winner whatever the piles say ("var", giving in). */
  winner?: number;
  how?: RoundResult["how"];
  by?: number;
}

function endRound(s: BuraState, end: Ending = {}): BuraState {
  const piles = s.piles.slice();
  let winner: number | null = null;
  if (end.bura !== undefined) winner = teamOf(end.bura);
  else if (end.winner !== undefined) winner = end.winner;
  else if (piles[0] !== piles[1]) winner = piles[0] > piles[1] ? 0 : 1;
  const gain = winner === null ? 0 : s.price;
  const next = { ...s, piles, scores: s.scores.slice(), call: null };
  if (winner !== null) next.scores[winner] += gain;
  next.result = {
    winner,
    gain,
    piles,
    bura: end.bura ?? null,
    how: end.bura !== undefined ? "bura" : (end.how ?? "points"),
    by: end.by ?? null,
  };
  next.phase = next.scores.some((v) => v >= next.target) ? "gameEnd" : "roundEnd";
  return next;
}

/** The player on turn puts down the cards (ids), or throws if that is not allowed. */
export function playCards(s: BuraState, ids: string[]): BuraState {
  if (s.phase !== "play") throw new Error("not playing");
  if (!isLegal(s, ids)) throw new Error("illegal play");
  const next = structuredClone(s);
  const me = next.turn;
  const cards = next.hands[me].filter((c) => ids.includes(c.id));
  const molotkaPlayed = next.trick.length > 0 && next.mol === null && cards.length > needOf(next, me);
  next.hands[me] = next.hands[me].filter((c) => !ids.includes(c.id));

  let hidden = false;
  let takesLead = false;
  if (next.trick.length === 0) {
    takesLead = true;
  } else if (molotkaPlayed) {
    next.mol = cards.length;
    takesLead = true;
  } else {
    // the player's cards in all (a late addition counts together with what they put down before) against the best so far
    takesLead = beatsCombo([...onTable(next, me), ...cards], bestCards(next), next.trump);
    hidden = !takesLead;
  }
  next.trick.push({ player: me, cards, hidden });
  if (takesLead) {
    next.best = next.trick.length - 1;
    // winning shows the cards that went down earlier as well
    for (const p of next.trick) if (p.player === me) p.hidden = false;
  }
  if (hidden) next.gave[me].push(...cards);

  const after = nextToAct(next);
  if (after === null) next.phase = "trickEnd";
  else next.turn = after;
  return next;
}

/** Takes the cards of the finished trick into the winner's team pile. */
function collect(next: BuraState, winner: number) {
  const team = teamOf(winner);
  for (const play of next.trick) {
    const points = sumPoints(play.cards);
    next.piles[team] += points;
    if (play.hidden && teamOf(play.player) !== team) next.unknown[team] += play.cards.length;
    else next.known[team] += points;
    if (!play.hidden) next.seen.push(...play.cards);
  }
  next.tricks[team] += 1;
}

/** The finished trick goes to its winner. Two players then pause for a "var"; with four everybody draws at once. */
export function finishTrick(s: BuraState): BuraState {
  if (s.phase !== "trickEnd") throw new Error("no finished trick");
  const next = structuredClone(s);
  const winner = next.trick[next.best].player;
  collect(next, winner);
  next.last = { plays: next.trick, winner };
  next.trick = [];
  next.best = -1;
  next.mol = null;
  next.leader = next.turn = winner;
  // nobody can refill: whoever has run out ends the round
  if (next.deck.length === 0 && next.hands.some((h) => h.length === 0)) return endRound(next);
  if (next.players === 2) {
    next.phase = "var";
    return next;
  }
  return refill(next);
}

/** Cards are drawn one at a time round the table, starting with the winner of the trick. */
function refill(next: BuraState): BuraState {
  const winner = next.leader;
  let drawing = true;
  while (drawing && next.deck.length > 0) {
    drawing = false;
    for (let k = 0; k < next.players && next.deck.length > 0; k++) {
      const p = (winner + k) % next.players;
      if (next.hands[p].length < handSize(next.players)) {
        next.hands[p].push(next.deck.shift()!);
        drawing = true;
      }
    }
  }
  next.phase = "play";
  return checkBura(next);
}

/** The winner of the trick says "var" (and the round is decided on the spot) or carries on: cards are drawn and they lead. */
export function decideVar(s: BuraState, say: boolean): BuraState {
  if (s.phase !== "var") throw new Error("no var to decide");
  if (say) {
    const team = teamOf(s.turn);
    return endRound(structuredClone(s), { winner: s.piles[team] >= VAR_POINTS ? team : 1 - team, how: "var", by: s.turn });
  }
  return refill(structuredClone(s));
}

/** May the player on turn call (raise the price of the round)? */
export function canCall(s: BuraState, player = s.turn): boolean {
  return s.phase === "play" && s.turn === player && s.call === null && s.price < MAX_PRICE && s.raised !== teamOf(player);
}

/** The price a call by the player on turn would set. */
export const nextLevel = (s: BuraState) => s.price + 1;

export function makeCall(s: BuraState): BuraState {
  if (!canCall(s)) throw new Error("cannot call now");
  const next = structuredClone(s);
  next.call = { by: next.turn, level: s.price + 1 };
  next.phase = "call";
  next.turn = (next.turn + 1) % next.players;
  return next;
}

/** The side that was called accepts, raises (the next call up) or gives in (the caller gets the price from before). */
export function answerCall(s: BuraState, answer: "accept" | "raise" | "fold"): BuraState {
  if (s.phase !== "call" || !s.call) throw new Error("no call to answer");
  const next = structuredClone(s);
  const call = s.call;
  if (answer === "fold") return endRound(next, { winner: teamOf(call.by), how: "fold", by: call.by });
  next.price = call.level;
  if (answer === "accept") {
    next.raised = teamOf(call.by);
    next.call = null;
    next.phase = "play";
    next.turn = call.by;
    return next;
  }
  if (call.level >= MAX_PRICE) throw new Error("nothing above shashi");
  next.call = { by: next.turn, level: call.level + 1 };
  next.turn = (next.turn + 1) % next.players;
  return next;
}

/** One step of any kind by the player on turn. */
export function act(s: BuraState, action: BuraAction): BuraState {
  switch (action.type) {
    case "play":
      return playCards(s, action.ids);
    case "call":
      return makeCall(s);
    case "answer":
      return answerCall(s, action.answer);
    case "var":
      return decideVar(s, action.say);
  }
}

/** After a round: the next deal (the dealer changes every round). */
export function nextRound(s: BuraState, rng: Rng = Math.random): BuraState {
  if (s.phase !== "roundEnd") throw new Error("round is not finished");
  const next = structuredClone(s);
  next.round += 1;
  next.dealer = (next.dealer + 1) % next.players;
  return deal(next, rng);
}

/**
 * The cards a player cannot place: not in their own hand, not shown, not the trump card, and not something they
 * threw down themselves. (What the others threw down face down has left the game without anybody seeing it, so
 * those cards are still in this list.)
 */
export function unseenCards(s: BuraState, player: number): NormalCard[] {
  const known = new Set<string>([
    ...s.hands[player].map((c) => c.id),
    ...s.seen.map((c) => c.id),
    ...s.gave[player].map((c) => c.id),
    ...s.trick.filter((p) => !p.hidden || p.player === player).flatMap((p) => p.cards.map((c) => c.id)),
  ]);
  // The trump card lies face up at the bottom of the pile for as long as the pile lasts.
  if (s.deck.length > 0) known.add(s.trumpCard.id);
  return buildDeck(s.players).filter((c) => !known.has(c.id));
}
