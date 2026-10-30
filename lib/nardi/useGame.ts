"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playCardSound, playDealSound } from "../sound";
import type { BotProfile } from "../joker/botProfiles";
import { botTurn, type NardiStyle } from "./bot";
import { legalSteps, needsRoll, newGame, roll, step, type NardiState, type Step } from "./engine";

export const HUMAN = 0;
const ROLL_DELAY = 900;
const MOVE_DELAY = 750;

/** A bot's chance of a careless turn by level. */
const STYLE: Record<BotProfile["tier"], NardiStyle> = {
  easy: { mistake: 0.35 },
  medium: { mistake: 0.1 },
  hard: { mistake: 0 },
};

/** Holds a game of nardi against a bot and plays the bot's turns with small pauses. */
export function useNardiGame() {
  const [game, setGame] = useState<NardiState | null>(null);
  const [bot, setBot] = useState<BotProfile | null>(null);
  /** The move that was played last, to show where a checker came from and went. */
  const [last, setLast] = useState<{ by: 0 | 1; step: Step } | null>(null);
  const plan = useRef<Step[] | null>(null);

  const start = useCallback((opponent: BotProfile) => {
    setBot(opponent);
    setLast(null);
    plan.current = null;
    setGame(newGame(Math.random() < 0.5 ? 0 : 1));
  }, []);
  const quit = useCallback(() => setGame(null), []);

  const rollHuman = useCallback(() => {
    if (!game || game.turn !== HUMAN || !needsRoll(game)) return;
    playDealSound();
    setGame(roll(game));
  }, [game]);

  const move = useCallback(
    (st: Step) => {
      if (!game || game.turn !== HUMAN || game.winner !== null) return;
      try {
        const next = step(game, st);
        playCardSound();
        setLast({ by: HUMAN, step: st });
        setGame(next);
      } catch {
        // not a legal move: ignore the tap
      }
    },
    [game],
  );

  useEffect(() => {
    if (!game || !bot || game.winner !== null || game.turn === HUMAN) return;
    const timer = setTimeout(
      () => {
        if (needsRoll(game)) {
          plan.current = null;
          playDealSound();
          setGame(roll(game));
          return;
        }
        if (!plan.current || plan.current.length === 0) plan.current = botTurn(game, STYLE[bot.tier]);
        const st = plan.current.shift();
        // The plan was made for this very position; stay safe if a step is not legal after all.
        if (!st || !legalSteps(game).some((m) => m.from === st.from && m.to === st.to && m.die === st.die)) {
          plan.current = null;
          setGame({ ...game });
          return;
        }
        playCardSound();
        setLast({ by: 1, step: st });
        setGame(step(game, st));
      },
      game.dice.length === 0 ? ROLL_DELAY : MOVE_DELAY,
    );
    return () => clearTimeout(timer);
  }, [game, bot]);

  return { game, bot, last, start, quit, rollHuman, move };
}
