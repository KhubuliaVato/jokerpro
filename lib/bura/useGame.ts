"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { botById, type BotProfile } from "../joker/botProfiles";
import { botMove, STRONG_STYLE, styleFor } from "./bot";
import { createGame, finishTrick, nextRound, playCards, type BuraPlayers, type BuraState } from "./engine";

export const HUMAN = 0;
const BOT_DELAY = 800;
export const TRICK_PAUSE = 1500;
/** Seconds the human has for each move. */
export const TURN_SECONDS = 40;
/** Timed-out moves in a row after which the player is removed from the game. */
const AFK_LIMIT = 2;

/** Holds the game against bots, drives them and the pause that lets a finished trick be seen. */
export function useBuraGame() {
  const [game, setGame] = useState<BuraState | null>(null);
  const [bots, setBots] = useState<BotProfile[]>([]);
  const [kicked, setKicked] = useState(false);
  const [timer, setTimer] = useState({ key: "", left: TURN_SECONDS });
  const deadline = useRef(0);
  const missed = useRef(0);
  const gameRef = useRef<BuraState | null>(null);
  const botsRef = useRef<BotProfile[]>([]);
  useEffect(() => {
    gameRef.current = game;
    botsRef.current = bots;
  }, [game, bots]);

  const start = useCallback((players: BuraPlayers, opponents: BotProfile[] | string[]) => {
    missed.current = 0;
    setKicked(false);
    setBots(opponents.map((o) => (typeof o === "string" ? botById(o) : o)));
    setGame(createGame(players));
  }, []);
  const quit = useCallback(() => setGame(null), []);
  const next = useCallback(() => setGame((g) => (g && g.phase === "roundEnd" ? nextRound(g) : g)), []);

  const play = useCallback((ids: string[]) => {
    missed.current = 0;
    setGame((g) => {
      if (!g || g.phase !== "play" || g.turn !== HUMAN) return g;
      try {
        return playCards(g, ids);
      } catch {
        return g;
      }
    });
  }, []);

  // A new key whenever the human has a fresh move to make.
  const turnKey =
    game && game.phase === "play" && game.turn === HUMAN
      ? `${game.round}:${game.tricks[0] + game.tricks[1]}:${game.trick.length}`
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
        const g = gameRef.current;
        if (missed.current >= AFK_LIMIT) {
          setKicked(true);
          setGame(null);
        } else if (g && g.phase === "play" && g.turn === HUMAN) {
          setGame(playCards(g, botMove(g, STRONG_STYLE)));
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [turnKey]);
  const secondsLeft = turnKey && timer.key === turnKey ? timer.left : turnKey ? TURN_SECONDS : null;

  useEffect(() => {
    if (!game) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    if (game.phase === "trickEnd") {
      t = setTimeout(() => setGame((g) => (g && g.phase === "trickEnd" ? finishTrick(g) : g)), TRICK_PAUSE);
    } else if (game.phase === "play" && game.turn !== HUMAN) {
      t = setTimeout(() => {
        const g = gameRef.current;
        if (!g || g.phase !== "play" || g.turn === HUMAN) return;
        const bot = botsRef.current[g.turn - 1];
        setGame(playCards(g, botMove(g, bot ? styleFor(bot) : STRONG_STYLE)));
      }, BOT_DELAY);
    }
    return () => clearTimeout(t);
  }, [game]);

  return { game, bots, secondsLeft, kicked, start, quit, next, play };
}
