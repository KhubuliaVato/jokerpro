import { buildDeck, shuffle, type Card, type Rng } from "./cards";
import {
  finishTrick,
  legalBids,
  legalPlays,
  placeBid,
  playCard,
  type GameState,
  type PlayOption,
} from "./engine";
import { botBid, botPlay, pickSuit } from "./bot";
import { PERFECT_STYLE } from "./botProfiles";

/**
 * The pro bot. It never looks at the other players' cards: it only knows its own hand, what was played and how many
 * cards each player holds. For each decision it deals the unknown cards to the others at random (many times over),
 * plays the rest of the hand out with the ordinary bot in each of these imagined deals, and picks the move that
 * scores best on average. This is how strong programs play bridge and poker too.
 */
export interface ProOptions {
  /** Time it may think about one decision (ms). */
  budgetMs?: number;
  /** Fewest imagined deals it tries even when out of time. */
  minWorlds?: number;
  /** Most imagined deals. */
  maxWorlds?: number;
  rng?: Rng;
}

const DEFAULTS = { budgetMs: 110, minWorlds: 4, maxWorlds: 60 };

const deck = buildDeck();

/** What the player can say is not in the other hands: everything except own cards, played cards and the face-up trump card. */
function unknownCards(s: GameState, me: number): Card[] {
  const known = new Set<string>([...s.hands[me], ...s.played].map((c) => c.id));
  if (s.trumpCard) known.add(s.trumpCard.id);
  return deck.filter((c) => !known.has(c.id));
}

/** One imagined deal: the unknown cards go to the others, in the numbers they really hold. */
function imagine(s: GameState, me: number, pool: Card[], rng: Rng): GameState {
  const cards = shuffle(pool, rng);
  const world: GameState = { ...s, history: [], hands: s.hands.map((h) => h), bids: s.bids.slice(), taken: s.taken.slice() };
  let at = 0;
  world.hands = s.hands.map((h, p) => {
    if (p === me) return h;
    const mine = cards.slice(at, at + h.length);
    at += h.length;
    return mine;
  });
  return world;
}

/** Plays the hand to its end with the ordinary bot for everyone; returns the points of each player. */
function finishHand(start: GameState): number[] | null {
  let s = start;
  for (let guard = 0; guard < 300; guard++) {
    if (s.phase === "bidding") s = placeBid(s, botBid(s, s.turn, PERFECT_STYLE));
    else if (s.phase === "playing") s = playCard(s, botPlay(s, s.turn, PERFECT_STYLE));
    else if (s.phase === "trickEnd") s = finishTrick(s);
    else break;
  }
  return s.history.length > 0 ? s.history[s.history.length - 1].points : null;
}

/** Tries every candidate in the same imagined deals and returns the mean points of each. */
function evaluate<T>(
  s: GameState,
  me: number,
  candidates: T[],
  start: (world: GameState, candidate: T) => GameState,
  opts: ProOptions,
): number[] {
  const o = { ...DEFAULTS, ...opts };
  const rng = o.rng ?? Math.random;
  const pool = unknownCards(s, me);
  const sums = candidates.map(() => 0);
  const began = Date.now();
  let worlds = 0;
  while (worlds < o.maxWorlds && (worlds < o.minWorlds || Date.now() - began < o.budgetMs)) {
    const world = imagine(s, me, pool, rng);
    candidates.forEach((c, i) => {
      const points = finishHand(start(world, c));
      sums[i] += points ? points[me] : 0;
    });
    worlds++;
  }
  return sums.map((x) => x / Math.max(1, worlds));
}

/** Picks the first candidate with the best score; `preferred` (the ordinary bot's choice) wins ties. */
function best<T>(candidates: T[], scores: number[], preferred: number): T {
  let pick = preferred;
  candidates.forEach((_, i) => {
    if (scores[i] > scores[pick] + 1e-9) pick = i;
  });
  return candidates[pick];
}

export function proPlay(s: GameState, me: number, opts: ProOptions = {}): PlayOption {
  const base = botPlay(s, me, PERFECT_STYLE);
  let options = legalPlays(s, me);
  if (options.length === 1) return options[0];
  // A lead with a joker names a suit: only the sensible suit of each mode is tried, not all four.
  if (s.trick.length === 0) {
    const suitFor = { high: pickSuit(s, s.hands[me], "high", PERFECT_STYLE), low: pickSuit(s, s.hands[me], "low", PERFECT_STYLE) };
    options = options.filter((o) => !o.card.joker || o.suit === suitFor[o.mode ?? "high"]);
  }
  const preferred = Math.max(
    0,
    options.findIndex((o) => o.card.id === base.card.id && o.mode === base.mode && o.suit === base.suit),
  );
  const scores = evaluate(s, me, options, (world, option) => playCard(world, option), opts);
  return best(options, scores, preferred);
}

export function proBid(s: GameState, me: number, opts: ProOptions = {}): number {
  const base = botBid(s, me, PERFECT_STYLE);
  // Only bids near the ordinary bot's estimate are worth a closer look.
  const candidates = legalBids(s, me).filter((b) => Math.abs(b - base) <= 2);
  if (candidates.length === 1) return candidates[0];
  const preferred = Math.max(0, candidates.indexOf(base));
  const scores = evaluate(s, me, candidates, (world, bid) => placeBid(world, bid), opts);
  return best(candidates, scores, preferred);
}
