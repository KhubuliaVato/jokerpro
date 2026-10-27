import { shuffle, type NormalCard, type Rng, type Suit } from "../joker/cards";
import type { BotProfile } from "../joker/botProfiles";
import {
  answerCall,
  bestCards,
  beatsCombo,
  canCall,
  cardPoints,
  decideVar,
  finishTrick,
  legalPlays,
  MAX_PRICE,
  nextLevel,
  onTable,
  playCards,
  sumPoints,
  teamOf,
  unseenCards,
  VAR_POINTS,
  type BuraAction,
  type BuraState,
} from "./engine";

/** How a Bura bot thinks: how many imagined deals it weighs, and how often it plays a random legal move instead. */
export interface BuraStyle {
  samples: number;
  mistake: number;
}

export const STRONG_STYLE: BuraStyle = { samples: 48, mistake: 0 };

/** The same nine bots as in Joker; their level decides how carefully they play. */
export function styleFor(bot: Pick<BotProfile, "style">): BuraStyle {
  const m = bot.style.mistake;
  return { samples: m > 0.15 ? 6 : m > 0.05 ? 18 : 48, mistake: m };
}

/** What keeping a card is worth to its owner: a trump is a way of winning later. */
const keepValue = (c: NormalCard, trump: Suit) => (c.suit === trump ? 4 + 0.6 * (c.rank - 6) : 0);
const spend = (cards: NormalCard[], trump: Suit) => cards.reduce((n, c) => n + cardPoints(c.rank) + keepValue(c, trump), 0);

/** What a player does with no cleverness: the cheapest way to take the lead, else the cheapest throw-away (or points for a partner). */
function simplePick(s: BuraState, options: NormalCard[][]): NormalCard[] {
  const me = s.turn;
  if (s.trick.length === 0) {
    const singles = options.filter((o) => o.length === 1);
    const pool = singles.length > 0 ? singles : options;
    return pool.reduce((best, c) => (spend(c, s.trump) < spend(best, s.trump) ? c : best));
  }
  const best = s.trick[s.best];
  if (teamOf(best.player) === teamOf(me)) {
    // a partner is winning: feed them points, keep the trumps
    const feed = (c: NormalCard[]) => sumPoints(c) - c.reduce((n, x) => n + keepValue(x, s.trump), 0) * 2;
    return options.reduce((top, c) => (feed(c) > feed(top) ? c : top));
  }
  const table = bestCards(s);
  const winning = options.filter((c) => beatsCombo([...onTable(s, me), ...c], table, s.trump));
  const pool = winning.length > 0 ? winning : options;
  return pool.reduce((cheapest, c) => (spend(c, s.trump) < spend(cheapest, s.trump) ? c : cheapest));
}

/** Plays out the rest of the trick with the other hands guessed, and says how good it was for `me` (in points). */
function valueOf(s: BuraState, me: number, option: NormalCard[], guess: NormalCard[][]): number {
  let sim = structuredClone(s);
  for (let p = 0; p < s.players; p++) if (p !== me) sim.hands[p] = guess[p];
  sim = playCards(sim, option.map((c) => c.id));
  for (let guard = 0; guard < 40 && sim.phase === "play"; guard++) {
    const options = legalPlays(sim);
    if (options.length === 0) break;
    sim = playCards(sim, simplePick(sim, options).map((c) => c.id));
  }
  const points = sumPoints(sim.trick.flatMap((p) => p.cards));
  const winner = sim.best >= 0 ? sim.trick[sim.best].player : me;
  const won = teamOf(winner) === teamOf(me);
  // Winning also brings the lead; spending trumps costs something for the rest of the round.
  const kept = option.reduce((n, c) => n + keepValue(c, s.trump), 0);
  return (won ? points + 1 : -points) - 0.6 * kept;
}

/** Imagined hands for the other players: the hidden cards dealt out at random (cards in the sizes they hold). */
function dealGuess(s: BuraState, me: number, cards: NormalCard[]): NormalCard[][] {
  const guess: NormalCard[][] = Array.from({ length: s.players }, () => []);
  let at = 0;
  for (let p = 0; p < s.players; p++) {
    if (p === me) continue;
    guess[p] = cards.slice(at, at + s.hands[p].length);
    at += s.hands[p].length;
  }
  return guess;
}

/** The cards the bot on turn puts down. */
export function botMove(s: BuraState, style: BuraStyle = STRONG_STYLE, rng: Rng = Math.random): string[] {
  const options = legalPlays(s);
  if (options.length === 0) throw new Error("nothing to play");
  const pick = (o: NormalCard[]) => o.map((c) => c.id);
  if (options.length === 1) return pick(options[0]);
  if (style.mistake > 0 && rng() < style.mistake) return pick(options[Math.floor(rng() * options.length)]);

  const me = s.turn;
  const unseen = unseenCards(s, me);
  const totals = options.map(() => 0);
  for (let i = 0; i < style.samples; i++) {
    const guess = dealGuess(s, me, shuffle(unseen, rng));
    options.forEach((o, k) => {
      totals[k] += valueOf(s, me, o, guess);
    });
  }
  let best = 0;
  for (let k = 1; k < options.length; k++) if (totals[k] > totals[best]) best = k;
  return pick(options[best]);
}

/** The chance (0 to 1) that the team of `me` takes the round: imagined deals of what is hidden, each played to the end with simple play. */
export function winChance(s: BuraState, me: number, samples: number, rng: Rng = Math.random): number {
  const unseen = unseenCards(s, me);
  const trumpLast = s.deck.length > 0 ? [s.trumpCard] : [];
  let wins = 0;
  for (let i = 0; i < samples; i++) {
    const cards = shuffle(unseen, rng);
    let sim = structuredClone(s);
    const guess = dealGuess(s, me, cards);
    let at = 0;
    for (let p = 0; p < s.players; p++) {
      if (p === me) continue;
      sim.hands[p] = guess[p];
      at += s.hands[p].length;
    }
    sim.deck = [...cards.slice(at, at + Math.max(0, s.deck.length - trumpLast.length)), ...trumpLast];
    for (let guard = 0; guard < 300 && sim.phase !== "roundEnd" && sim.phase !== "gameEnd"; guard++) {
      if (sim.phase === "call") sim = answerCall(sim, "accept");
      else if (sim.phase === "var") sim = decideVar(sim, false);
      else if (sim.phase === "trickEnd") sim = finishTrick(sim);
      else {
        const options = legalPlays(sim);
        if (options.length === 0) break;
        sim = playCards(sim, simplePick(sim, options).map((c) => c.id));
      }
    }
    const winner = sim.result?.winner;
    wins += winner === undefined || winner === null ? 0.5 : winner === teamOf(me) ? 1 : 0;
  }
  return wins / samples;
}

/** What the bot thinks its team's pile is worth: what it has seen plus a guess at the cards the others threw down on it. */
function pileEstimate(s: BuraState, team: number): number {
  const left = Math.max(1, s.deck.length + s.hands.reduce((n, h) => n + h.length, 0));
  const pointsLeft = 120 - s.piles[0] - s.piles[1];
  return s.known[team] + s.unknown[team] * (pointsLeft / left);
}

/** Whatever the bot on turn does: puts down cards, makes or answers a call, or decides on "var". */
export function botAct(s: BuraState, style: BuraStyle = STRONG_STYLE, rng: Rng = Math.random): BuraAction {
  const me = s.turn;
  const samples = Math.max(6, Math.round(style.samples / 2));
  if (s.phase === "var") {
    const team = teamOf(me);
    // it only knows what it has seen of its pile; a careless bot is readier to take the risk
    const margin = style.mistake > 0.15 ? 1 : 4;
    const say = s.known[team] >= VAR_POINTS || (s.unknown[team] > 0 && pileEstimate(s, team) >= VAR_POINTS + margin);
    return { type: "var", say };
  }
  if (s.phase === "call" && s.call) {
    const p = winChance(s, me, samples, rng);
    const level = s.call.level;
    if (level < MAX_PRICE && p > 0.78 && rng() < 0.6) return { type: "answer", answer: "raise" };
    // accepting is worth level * (2p - 1) against losing the price from before
    return { type: "answer", answer: level * (2 * p - 1) > -s.price ? "accept" : "fold" };
  }
  if (canCall(s, me) && rng() > 0.35) {
    const level = nextLevel(s);
    if (winChance(s, me, samples, rng) > 0.64 + 0.04 * level) return { type: "call" };
  }
  return { type: "play", ids: botMove(s, style, rng) };
}
