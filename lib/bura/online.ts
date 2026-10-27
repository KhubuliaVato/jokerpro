import type { NormalCard } from "../joker/cards";
import { botAct, STRONG_STYLE } from "./bot";
import { act, finishTrick, nextRound, teamOf, type BuraAction, type BuraState } from "./engine";

export { ONLINE_AFK_LIMIT, ONLINE_TURN_SECONDS } from "../joker/online";

/** What an online Bura table stores in its rules. */
export interface BuraRules {
  game: "bura";
  format: "p2" | "p4";
  players: 2 | 4;
}

const hidden = (id: string): NormalCard => ({ joker: false, suit: "S", rank: 6, id });

/**
 * The game as one player may see it: they sit at seat 0 and the others follow clockwise, other hands and the
 * pile are blank cards (the trump card is public), and the team numbers are swapped when they are on team 1.
 */
export function viewFor(state: BuraState, seat: number): BuraState {
  const n = state.players;
  const flip = teamOf(seat) === 1;
  const teams = <T>(pair: T[]): T[] => (flip ? [pair[1], pair[0]] : pair);
  const view = structuredClone(state);
  view.hands = state.hands.map((_, i) => {
    const real = (i + seat) % n;
    return i === 0 ? state.hands[real] : state.hands[real].map((__, k) => hidden(`hidden-${real}-${k}`));
  });
  view.deck = state.deck.map((c, i) => (i === state.deck.length - 1 ? c : hidden(`deck-${i}`)));
  view.seen = [];
  view.dealer = (state.dealer - seat + n) % n;
  view.leader = (state.leader - seat + n) % n;
  view.turn = (state.turn - seat + n) % n;
  view.trick = state.trick.map((p) => ({ ...p, player: (p.player - seat + n) % n }));
  view.last = state.last && {
    plays: state.last.plays.map((p) => ({ ...p, player: (p.player - seat + n) % n })),
    winner: (state.last.winner - seat + n) % n,
  };
  // what the others have collected is the secret that makes "var" a gamble
  const over = state.phase === "roundEnd" || state.phase === "gameEnd";
  view.piles = over ? teams(state.piles) : [state.piles[teamOf(seat)], 0];
  view.call = state.call && { ...state.call, by: (state.call.by - seat + n) % n };
  view.raised = state.raised === null ? null : flip ? 1 - state.raised : state.raised;
  view.tricks = teams(state.tricks);
  view.scores = teams(state.scores);
  if (state.result) {
    view.result = {
      ...state.result,
      winner: state.result.winner === null ? null : flip ? 1 - state.result.winner : state.result.winner,
      piles: teams(state.result.piles),
      bura: state.result.bura === null ? null : (state.result.bura - seat + n) % n,
      by: state.result.by === null ? null : (state.result.by - seat + n) % n,
    };
  }
  return view;
}

/** The bots' moves, until a human has to decide (or the trick / round is over and the clients take a breath). */
export function settle(state: BuraState, isBot: (seat: number) => boolean): BuraState {
  let s = state;
  for (let i = 0; i < 400 && isActivePhase(s) && isBot(s.turn); i++) s = botStep(s);
  return s;
}

/** One move of the standard bot for whoever is on turn (also used when a player's time runs out). */
export const botStep = (s: BuraState): BuraState => act(s, botAct(s, { ...STRONG_STYLE, samples: 24 }));

/** After the pause that lets everybody see the finished trick or round. */
export function advance(s: BuraState): BuraState {
  if (s.phase === "trickEnd") return finishTrick(s);
  if (s.phase === "roundEnd") return nextRound(s);
  return s;
}

export const isActivePhase = (s: BuraState) => s.phase === "play" || s.phase === "call" || s.phase === "var";

/** Result of the whole match for the player in `seat`. */
export function resultFor(state: BuraState, seat: number) {
  const mine = teamOf(seat);
  const won = state.scores[mine] >= state.target && state.scores[mine] > state.scores[1 - mine];
  return {
    place: won ? 1 : 2,
    score: state.scores[mine],
    scores: Array.from({ length: state.players }, (_, k) => state.scores[teamOf(seat + k)]),
  };
}

/** What a client sends as its move, checked: cards to play, a call, an answer to a call or a "var". */
export function parseAction(move: unknown): BuraAction {
  const m = (move ?? {}) as { type?: unknown; ids?: unknown; answer?: unknown; say?: unknown };
  if (Array.isArray(m.ids) && (m.type === undefined || m.type === "play")) return { type: "play", ids: m.ids.map(String) };
  if (m.type === "call") return { type: "call" };
  if (m.type === "answer" && (m.answer === "accept" || m.answer === "raise" || m.answer === "fold")) return { type: "answer", answer: m.answer };
  if (m.type === "var" && typeof m.say === "boolean") return { type: "var", say: m.say };
  throw new Error("illegal");
}
