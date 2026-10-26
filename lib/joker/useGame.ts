"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { botBid, botChooseTrump, botPlay } from "./bot";
import type { Suit } from "./cards";
import {
  chooseTrump,
  createGame,
  finishTrick,
  nextHand,
  placeBid,
  playCard,
  type GameState,
  type PlayOption,
} from "./engine";
import type { Rules } from "./rules";

export const HUMAN = 0;

const BOT_DELAY = 750;
export const TRICK_PAUSE = 1700;
/** Short beat after the last trick before the next deal. */
export const HAND_END_PAUSE = 700;
/** Seconds the human has for each choice or move. */
export const TURN_SECONDS = 40;
/** Timed-out turns in a row after which the player is removed from the game. */
const AFK_LIMIT = 2;

/** The move a bot would make for the player on turn; used when the timer runs out. */
function autoMove(g: GameState): GameState {
  if (g.phase === "trump") return chooseTrump(g, botChooseTrump(g.hands[g.turn]));
  if (g.phase === "bidding") return placeBid(g, botBid(g, g.turn));
  if (g.phase === "playing") return playCard(g, botPlay(g, g.turn));
  return g;
}

/** Holds the game, drives the bots and the pause that lets a finished trick be seen. */
export function useJokerGame() {
  const [game, setGame] = useState<GameState | null>(null);
  const [timer, setTimer] = useState({ key: "", left: TURN_SECONDS });
  const deadline = useRef(0);
  const missed = useRef(0);
  const [kicked, setKicked] = useState(false);

  // A new key whenever the human has a fresh decision to make.
  const turnKey =
    game &&
    game.turn === HUMAN &&
    (game.phase === "trump" || game.phase === "bidding" || game.phase === "playing")
      ? `${game.handIndex}:${game.phase}:${game.played.length}:${game.bids.filter((b) => b !== null).length}`
      : null;

  useEffect(() => {
    if (!turnKey) return;
    deadline.current = Date.now() + TURN_SECONDS * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setTimer({ key: turnKey, left });
      if (left === 0) {
        clearInterval(id);
        missed.current += 1;
        if (missed.current >= AFK_LIMIT) {
          setKicked(true);
          setGame(null);
        } else {
          setGame((g) => (g && g.turn === HUMAN ? autoMove(g) : g));
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [turnKey]);

  const secondsLeft = turnKey && timer.key === turnKey ? timer.left : turnKey ? TURN_SECONDS : null;

  const start = useCallback((rules: Rules) => {
    missed.current = 0;
    setKicked(false);
    setGame(createGame(rules));
  }, []);
  const quit = useCallback(() => setGame(null), []);

  const bid = useCallback(
    (n: number) => {
      missed.current = 0;
      setGame((g) => (g ? placeBid(g, n) : g));
    },
    [],
  );
  const pickTrump = useCallback(
    (suit: Suit | null) => {
      missed.current = 0;
      setGame((g) => (g ? chooseTrump(g, suit) : g));
    },
    [],
  );
  const play = useCallback(
    (option: PlayOption) => {
      missed.current = 0;
      setGame((g) => (g ? playCard(g, option) : g));
    },
    [],
  );

  useEffect(() => {
    if (!game) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (game.phase === "trickEnd") {
      timer = setTimeout(() => setGame((g) => (g ? finishTrick(g) : g)), TRICK_PAUSE);
    } else if (game.phase === "handEnd") {
      timer = setTimeout(() => setGame((g) => (g ? nextHand(g) : g)), HAND_END_PAUSE);
    } else if (
      game.turn !== HUMAN &&
      (game.phase === "trump" || game.phase === "bidding" || game.phase === "playing")
    ) {
      timer = setTimeout(() => {
        setGame((g) => (g && g.turn !== HUMAN ? autoMove(g) : g));
      }, BOT_DELAY);
    }
    return () => clearTimeout(timer);
  }, [game]);

  return { game, secondsLeft, kicked, start, quit, bid, pickTrump, play };
}
