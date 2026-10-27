import { botBid, botChooseTrump, botPlay } from "./bot";
import type { Card, Suit } from "./cards";
import {
  chooseTrump,
  finishTrick,
  nextHand,
  placeBid,
  playCard,
  PLAYERS,
  totals,
  type GameState,
  type PlayOption,
} from "./engine";

/**
 * Online play: the server owns the full game state, every player only ever receives a *view* of it,
 * rotated so that they sit at seat 0 (the bottom of their screen) with the other hands hidden.
 * Everything here is pure so the server function and the tests share it.
 */

/** Seconds a player has for each decision; the same on the table and on the server. */
export const ONLINE_TURN_SECONDS = 40;
/** Timed-out turns in a row after which a player's seat is handed to a bot. */
export const ONLINE_AFK_LIMIT = 2;

export type Action =
  | { type: "bid"; bid: number }
  | { type: "trump"; suit: Suit | null }
  | { type: "play"; option: PlayOption };

/** Phases in which somebody has to decide something. */
export const isActivePhase = (s: GameState) =>
  s.phase === "trump" || s.phase === "bidding" || s.phase === "playing";

/** The hidden card shown in place of a hand the viewer must not see. */
const hidden = (i: number): Card => ({ joker: false, suit: "S", rank: 6, id: `hidden-${i}` });

/** Real seat → the seat a viewer who sits at `me` sees it at. */
export const viewSeat = (real: number, me: number) => (real - me + PLAYERS) % PLAYERS;
/** Inverse of {@link viewSeat}. */
export const realSeat = (view: number, me: number) => (view + me) % PLAYERS;

/** What the player at real seat `me` is allowed to see of the game. */
export function viewFor(state: GameState, me: number): GameState {
  const rotate = <T>(arr: T[]): T[] => arr.map((_, k) => arr[realSeat(k, me)]);
  const view = structuredClone(state);

  view.hands = state.hands.map((_, k) => {
    const real = realSeat(k, me);
    return k === 0 ? state.hands[real] : state.hands[real].map((__, i) => hidden(real * 100 + i));
  });
  view.rest = [];
  view.dealer = viewSeat(state.dealer, me);
  view.turn = viewSeat(state.turn, me);
  view.bids = rotate(state.bids);
  view.taken = rotate(state.taken);
  view.trick = state.trick.map((p) => ({ ...p, player: viewSeat(p.player, me) }));
  view.trickWinner = state.trickWinner === null ? null : viewSeat(state.trickWinner, me);
  view.lastTrick = state.lastTrick && {
    plays: state.lastTrick.plays.map((p) => ({ ...p, player: viewSeat(p.player, me) })),
    winner: viewSeat(state.lastTrick.winner, me),
  };
  view.strength = [];
  // `strength` is dropped here: players never see how a deal was valued.
  view.history = state.history.map((record) => {
    const h = { ...record };
    delete h.strength;
    return { ...h, bids: rotate(h.bids), taken: rotate(h.taken), points: rotate(h.points) };
  });
  view.premiums = state.premiums.map((row) => rotate(row));
  return view;
}

/** Applies a player's decision. Throws if it is not their turn or the move is illegal. */
export function applyAction(state: GameState, seat: number, action: Action): GameState {
  if (!isActivePhase(state)) throw new Error("nothing to decide right now");
  if (state.turn !== seat) throw new Error("not your turn");
  if (action.type === "bid") return placeBid(state, action.bid);
  if (action.type === "trump") return chooseTrump(state, action.suit);
  return playCard(state, action.option);
}

/** The move a bot makes for whoever is on turn (also used when a player's timer runs out). */
export function botMove(state: GameState): GameState {
  if (state.phase === "trump") return chooseTrump(state, botChooseTrump(state.hands[state.turn]));
  if (state.phase === "bidding") return placeBid(state, botBid(state, state.turn));
  if (state.phase === "playing") return playCard(state, botPlay(state, state.turn));
  throw new Error("nothing to decide right now");
}

/** Lets bots move for as long as it is a bot seat's turn. */
export function settle(state: GameState, isBot: (seat: number) => boolean): GameState {
  let s = state;
  // A hand has at most 36 decisions per seat; the cap only guards against a logic error.
  for (let guard = 0; guard < 400 && isActivePhase(s) && isBot(s.turn); guard++) s = botMove(s);
  return s;
}

/** Moves the game past a finished trick / hand (clients ask for this after the pause that lets it be seen). */
export function advance(state: GameState): GameState {
  if (state.phase === "trickEnd") return finishTrick(state);
  if (state.phase === "handEnd") return nextHand(state);
  return state;
}

/** Final standing of the player at real seat `seat`, rotated so the player is first. */
export function resultFor(state: GameState, seat: number) {
  const scores = totals(state);
  const rotated = scores.map((_, k) => scores[realSeat(k, seat)]);
  return {
    scores: rotated,
    score: rotated[0],
    place: 1 + rotated.filter((s) => s > rotated[0]).length,
  };
}
