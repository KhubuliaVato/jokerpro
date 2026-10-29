"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { botById, type BotProfile } from "../joker/botProfiles";
import { botAct, pokerStyleFor, STRONG_POKER_STYLE } from "./bot";
import { act, createGame, HUMAN, nextHand, optionsFor, type PokerAction, type PokerConfig, type PokerState } from "./engine";

const BOT_DELAY = 900;
/** How long the result of a hand stays before the next one is dealt by itself. */
export const HAND_PAUSE = 7000;
/** Seconds the human has for each move. */
export const TURN_SECONDS = 40;
/** Timed-out moves in a row after which the player is removed from the game. */
const AFK_LIMIT = 2;

/** Holds a game of Texas Hold'em against bots and drives the bots, the timer and the pause between hands. */
export function usePokerGame() {
  const [game, setGame] = useState<PokerState | null>(null);
  const [bots, setBots] = useState<BotProfile[]>([]);
  const [kicked, setKicked] = useState(false);
  const [timer, setTimer] = useState({ key: "", left: TURN_SECONDS });
  const deadline = useRef(0);
  const missed = useRef(0);
  const gameRef = useRef<PokerState | null>(null);
  const botsRef = useRef<BotProfile[]>([]);
  useEffect(() => {
    gameRef.current = game;
    botsRef.current = bots;
  }, [game, bots]);

  const start = useCallback((config: PokerConfig, opponents: (BotProfile | string)[]) => {
    missed.current = 0;
    setKicked(false);
    setBots(opponents.map((o) => (typeof o === "string" ? botById(o) : o)));
    setGame(createGame(config));
  }, []);
  const quit = useCallback(() => setGame(null), []);
  const next = useCallback(() => setGame((g) => (g && g.phase === "handEnd" ? nextHand(g) : g)), []);

  /** Fold, check, call or raise of the human. */
  const play = useCallback((action: PokerAction) => {
    missed.current = 0;
    setGame((g) => {
      if (!g || g.turn !== HUMAN || g.phase !== "betting") return g;
      try {
        return act(g, action);
      } catch {
        return g;
      }
    });
  }, []);

  // A new key whenever the human has a fresh move to make.
  const turnKey =
    game && game.phase === "betting" && game.turn === HUMAN
      ? `${game.handNo}:${game.street}:${game.currentBet}:${game.seats[HUMAN].bet}`
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
        } else if (g && g.turn === HUMAN && g.phase === "betting") {
          // Out of time: check when that is free, otherwise fold.
          setGame(act(g, optionsFor(g).canCheck ? { type: "check" } : { type: "fold" }));
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [turnKey]);
  const secondsLeft = turnKey && timer.key === turnKey ? timer.left : turnKey ? TURN_SECONDS : null;

  useEffect(() => {
    if (!game) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    if (game.phase === "handEnd") {
      t = setTimeout(() => setGame((g) => (g && g.phase === "handEnd" ? nextHand(g) : g)), HAND_PAUSE);
    } else if (game.phase === "betting" && game.turn !== HUMAN) {
      t = setTimeout(() => {
        const g = gameRef.current;
        if (!g || g.phase !== "betting" || g.turn === HUMAN) return;
        const bot = botsRef.current[g.turn - 1];
        setGame(act(g, botAct(g, bot ? pokerStyleFor(bot) : STRONG_POKER_STYLE)));
      }, BOT_DELAY + Math.random() * 600);
    }
    return () => clearTimeout(t);
  }, [game]);

  return { game, bots, secondsLeft, kicked, start, quit, next, play };
}
