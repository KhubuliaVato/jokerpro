import type { NormalCard } from "../joker/cards";
import { botAct, STRONG_POKER_STYLE } from "./bot";
import { act, createGame, nextHand, type PokerAction, type PokerState } from "./engine";

export { ONLINE_AFK_LIMIT, ONLINE_TURN_SECONDS } from "../joker/online";

/** What an online Hold'em table stores in its rules: play chips, 2 to 6 friends, a code. */
export interface PokerRules {
  game: "poker";
  format: "p2" | "p3" | "p4" | "p5" | "p6";
  players: number;
  smallBlind: number;
  bigBlind: number;
  startStack: number;
}

const hidden = (id: string): NormalCard => ({ joker: false, suit: "S", rank: 6, id });

/** The table as the server deals it: random button, blinds posted, cards out. */
export function createPoker(rules: PokerRules): PokerState {
  return createGame({ smallBlind: rules.smallBlind, bigBlind: rules.bigBlind, startStack: rules.startStack, players: rules.players });
}

/**
 * The game as one player may see it: they sit at seat 0 and the others follow clockwise (the table screen shows
 * the human at seat 0), the other players' cards are blank unless turned up at a showdown, and the deck is gone.
 */
export function viewFor(state: PokerState, seat: number): PokerState {
  const n = state.seats.length;
  const rot = (i: number) => (i - seat + n) % n;
  const shown = new Set(state.result?.revealed ?? []);
  const view = structuredClone(state);
  view.seats = state.seats.map((_, i) => {
    const real = (i + seat) % n;
    const p = state.seats[real];
    const open = real === seat || shown.has(real);
    return { ...structuredClone(p), hole: open ? p.hole : p.hole.map((__, k) => hidden(`hidden-${real}-${k}`)) };
  });
  view.deck = [];
  view.dealer = rot(state.dealer);
  view.smallBlindSeat = rot(state.smallBlindSeat);
  view.bigBlindSeat = rot(state.bigBlindSeat);
  view.turn = rot(state.turn);
  view.winner = state.winner === null ? null : rot(state.winner);
  if (state.result) {
    view.result = {
      ...state.result,
      payouts: state.result.payouts.map((p) => ({ ...p, seat: rot(p.seat) })),
      revealed: state.result.revealed.map(rot),
      values: state.seats.map((_, i) => state.result!.values[(i + seat) % n]),
    };
  }
  return view;
}

/** One move of the standard bot for whoever is on turn (also used when a player's time runs out). */
export const botStep = (s: PokerState): PokerState => act(s, botAct(s, { ...STRONG_POKER_STYLE, sims: 60 }));

/** After the pause that lets everybody see the result of the hand: the next hand (or the end of the game). */
export const advance = (s: PokerState): PokerState => (s.phase === "handEnd" ? nextHand(s, Math.random, false) : s);

export const isActivePhase = (s: PokerState) => s.phase === "betting";

/** What a client sends as its move, checked. */
export function parseAction(move: unknown): PokerAction {
  const m = (move ?? {}) as { type?: unknown; to?: unknown };
  if (m.type === "fold" || m.type === "check" || m.type === "call") return { type: m.type };
  if (m.type === "raise" && typeof m.to === "number" && Number.isFinite(m.to)) return { type: "raise", to: m.to };
  throw new Error("illegal");
}
