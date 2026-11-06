"use client";

import { useState } from "react";
import { PLAYERS, type GameState, type Play } from "./engine";

/** One trick as this player saw it: the cards in the order they were put down, and who took it. */
export interface TrickLog {
  /** Index of the hand in the game (0-based). */
  hand: number;
  /** Cards played in the hand up to and including this trick: tells the tricks of a hand apart. */
  no: number;
  plays: Play[];
  winner: number;
}

/**
 * Writes down every trick that is shown to the player, so that at the end of the game the moves of each hand can
 * be looked at. Built only from what the player sees (the cards on the table), nothing is kept on the server.
 * A trick the player did not see (the page was closed for a while) is simply missing.
 */
export function useTrickLog(game: GameState | null): TrickLog[] {
  const [seen, setSeen] = useState<GameState | null>(null);
  const [log, setLog] = useState<TrickLog[]>([]);

  // "adjusting state while rendering": runs when the game changed, before the screen is drawn
  if (game !== seen) {
    setSeen(game);
    if (!game || (seen && game.handIndex < seen.handIndex)) {
      if (log.length > 0) setLog([]);
    }
    if (game && game.phase === "trickEnd" && game.trickWinner !== null && game.trick.length === PLAYERS) {
      const no = game.played.length;
      const fresh = !(seen && game.handIndex < seen.handIndex) && !log.some((l) => l.hand === game.handIndex && l.no === no);
      if (fresh) setLog((l) => [...l, { hand: game.handIndex, no, plays: game.trick.map((p) => ({ ...p })), winner: game.trickWinner as number }]);
    }
  }
  return log;
}
