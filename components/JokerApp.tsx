"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { GameState } from "@/lib/joker/engine";
import { useJokerGame } from "@/lib/joker/useGame";
import { saveJokerResult } from "@/lib/results";
import { getSupabase } from "@/lib/supabase";
import { Setup } from "./Setup";
import { Table } from "./Table";

type SaveState = "idle" | "saving" | "saved" | "failed";

export function JokerApp() {
  const { game, secondsLeft, kicked, start, quit, bid, pickTrump, play } = useJokerGame();
  const { user, configured } = useAuth();
  // The outcome of saving belongs to one finished game; for any other game it does not apply.
  const [outcome, setOutcome] = useState<{ game: GameState; state: SaveState } | null>(null);
  const saved = useRef<GameState | null>(null);
  const save: SaveState =
    game && outcome?.game === game ? outcome.state : game?.phase === "gameEnd" && user ? "saving" : "idle";

  // A finished game is saved once, for signed-in players.
  useEffect(() => {
    if (!game || game.phase !== "gameEnd") return;
    const supabase = getSupabase();
    if (!user || !supabase || saved.current === game) return;
    saved.current = game;
    saveJokerResult(supabase, user.id, game).then((err) => setOutcome({ game, state: err ? "failed" : "saved" }));
  }, [game, user]);

  if (!game) return <Setup onStart={start} kicked={kicked} />;

  const note =
    save === "saved" ? (
      <span className="text-emerald-300">✓ შედეგი შენახულია პროფილში</span>
    ) : save === "saving" ? (
      <span className="text-white/60">შედეგი ინახება…</span>
    ) : save === "failed" ? (
      <span className="text-red-300">შედეგის შენახვა ვერ მოხერხდა</span>
    ) : configured && !user ? (
      <span className="text-white/60">
        შედეგის შესანახად{" "}
        <Link href="/login" className="font-bold text-amber-300 underline">
          შედით ანგარიშში
        </Link>
      </span>
    ) : null;

  return (
    <Table
      game={game}
      secondsLeft={secondsLeft}
      onBid={bid}
      onTrump={pickTrump}
      onPlay={play}
      onQuit={quit}
      endNote={note}
    />
  );
}
