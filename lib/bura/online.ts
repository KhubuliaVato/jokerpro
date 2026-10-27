import type { NormalCard } from "../joker/cards";
import { botMove, STRONG_STYLE } from "./bot";
import { finishTrick, nextRound, playCards, teamOf, type BuraState } from "./engine";

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
  view.piles = teams(state.piles);
  view.tricks = teams(state.tricks);
  view.scores = teams(state.scores);
  if (state.result) {
    view.result = {
      ...state.result,
      winner: state.result.winner === null ? null : flip ? 1 - state.result.winner : state.result.winner,
      piles: teams(state.result.piles),
      bura: state.result.bura === null ? null : (state.result.bura - seat + n) % n,
    };
  }
  return view;
}

/** The bots' moves, until a human has to decide (or the trick / round is over and the clients take a breath). */
export function settle(state: BuraState, isBot: (seat: number) => boolean): BuraState {
  let s = state;
  for (let i = 0; i < 400 && s.phase === "play" && isBot(s.turn); i++) s = botStep(s);
  return s;
}

/** One move of the standard bot for whoever is on turn (also used when a player's time runs out). */
export const botStep = (s: BuraState): BuraState => playCards(s, botMove(s, { ...STRONG_STYLE, samples: 24 }));

/** After the pause that lets everybody see the finished trick or round. */
export function advance(s: BuraState): BuraState {
  if (s.phase === "trickEnd") return finishTrick(s);
  if (s.phase === "roundEnd") return nextRound(s);
  return s;
}

export const isActivePhase = (s: BuraState) => s.phase === "play";

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
