import type { BotProfile } from "../joker/botProfiles";
import type { NormalCard, Rng } from "../joker/cards";
import { bestHand, compareHands } from "./eval";
import { fullDeck, inHand, optionsFor, potOf, type PokerAction, type PokerState } from "./engine";

/** How a bot plays: all values from 0 to 1. */
export interface PokerStyle {
  /** How much equity it asks for before it puts chips in (0.5 is neutral). */
  tight: number;
  /** How often it bets and raises instead of just calling or checking. */
  aggression: number;
  /** How often it bets with a weak hand. */
  bluff: number;
  /** How readily it calls with a hand that is not good enough (a calling station is near 1). */
  loose: number;
  /** Simulations per decision: more is sharper and slower. */
  sims?: number;
}

export const STRONG_POKER_STYLE: PokerStyle = { tight: 0.55, aggression: 0.55, bluff: 0.1, loose: 0.1 };

/** Each bot has its own temper, so the table is not six copies of one player. */
const STYLES: Record<string, PokerStyle> = {
  nika: { tight: 0.15, aggression: 0.15, bluff: 0.02, loose: 0.9 }, // calls almost anything
  mzia: { tight: 0.85, aggression: 0.2, bluff: 0.0, loose: 0.0 }, // waits for the nuts
  gio: { tight: 0.2, aggression: 0.9, bluff: 0.4, loose: 0.5 }, // raises everything
  levani: { tight: 0.5, aggression: 0.4, bluff: 0.1, loose: 0.2 }, // plain and balanced
  nino: { tight: 0.65, aggression: 0.6, bluff: 0.08, loose: 0.05 }, // tight and aggressive
  mariami: { tight: 0.35, aggression: 0.65, bluff: 0.25, loose: 0.3 }, // loose and aggressive
  dato: { tight: 0.6, aggression: 0.55, bluff: 0.12, loose: 0.05 }, // solid
  tamar: { tight: 0.55, aggression: 0.5, bluff: 0.15, loose: 0.1 }, // balanced
  zura: { tight: 0.45, aggression: 0.75, bluff: 0.3, loose: 0.15 }, // pressure and bluffs
};

export function pokerStyleFor(bot: BotProfile): PokerStyle {
  return STYLES[bot.id] ?? STRONG_POKER_STYLE;
}

/**
 * Chance (0..1) that `hole` wins at the showdown against `opponents` random hands, a tie counting as a share,
 * by playing out the rest of the board `sims` times.
 */
export function equity(hole: NormalCard[], board: NormalCard[], opponents: number, sims: number, rng: Rng = Math.random): number {
  const known = new Set([...hole, ...board].map((c) => c.id));
  const rest = fullDeck().filter((c) => !known.has(c.id));
  const need = 5 - board.length;
  let score = 0;
  for (let k = 0; k < sims; k++) {
    // a partial shuffle: the cards needed for the board and for each opponent's hand
    const take = need + opponents * 2;
    for (let i = 0; i < take; i++) {
      const j = i + Math.floor(rng() * (rest.length - i));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    const full = [...board, ...rest.slice(0, need)];
    const mine = bestHand([...hole, ...full]).value;

    let ties = 1;
    let lost = false;
    for (let o = 0; o < opponents; o++) {
      const theirs = bestHand([rest[need + o * 2], rest[need + o * 2 + 1], ...full]).value;
      const c = compareHands(mine, theirs);
      if (c < 0) {
        lost = true;
        break;
      }
      if (c === 0) ties += 1;
    }
    if (!lost) score += 1 / ties;
  }
  return score / sims;
}

/** The move of the bot sitting at `state.turn`. */
export function botAct(state: PokerState, style: PokerStyle = STRONG_POKER_STYLE, rng: Rng = Math.random): PokerAction {
  const seat = state.turn;
  const p = state.seats[seat];
  const o = optionsFor(state, seat);
  const opponents = state.seats.filter((q, i) => i !== seat && inHand(q)).length;
  const eq = equity(p.hole, state.community, Math.max(1, opponents), style.sims ?? 120, rng);
  const pot = potOf(state);

  /** Raise to `fraction` of the pot (counting the call), within the legal range. */
  const raiseOf = (fraction: number): PokerAction => {
    const wanted = state.currentBet + Math.round((pot + o.toCall) * fraction);
    const to = Math.min(o.maxRaiseTo, Math.max(o.minRaiseTo, wanted));
    // Rounded to a whole small blind, so the numbers look like a player's.
    const step = Math.max(1, state.config.smallBlind);
    const snapped = Math.min(o.maxRaiseTo, Math.max(o.minRaiseTo, Math.round(to / step) * step));
    return { type: "raise", to: snapped };
  };

  // Several opponents: a hand has to be better to bet for value.
  const crowd = (opponents - 1) * 0.025;
  const valueEdge = 0.52 + (style.tight - 0.5) * 0.12 + crowd;

  if (o.toCall === 0) {
    if (o.canRaise && eq > valueEdge + 0.1 && rng() < 0.4 + style.aggression * 0.55) {
      return raiseOf(eq > 0.8 ? 0.8 : 0.5 + style.aggression * 0.25);
    }
    if (o.canRaise && eq < 0.4 && state.street > 0 && rng() < style.bluff * 0.5) return raiseOf(0.55);
    return { type: "check" };
  }

  // Facing a bet: the hand must be worth the price.
  const price = o.callCost / (pot + o.callCost);
  const need = price + (style.tight - 0.5) * 0.14 + 0.04 - style.loose * 0.08;
  if (eq < need) {
    if (rng() < style.loose * 0.12) return { type: "call" };
    return { type: "fold" };
  }
  if (o.canRaise && eq > valueEdge + 0.15 && rng() < style.aggression * 0.8) {
    if (eq > 0.88 && rng() < 0.35) return { type: "raise", to: o.maxRaiseTo };
    return raiseOf(eq > 0.8 ? 1 : 0.6 + style.aggression * 0.3);
  }
  if (o.canRaise && eq < 0.4 && rng() < style.bluff * 0.25) return raiseOf(0.8);
  return { type: "call" };
}
