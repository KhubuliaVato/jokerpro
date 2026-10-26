"use client";

import { useJokerGame } from "@/lib/joker/useGame";
import { Setup } from "./Setup";
import { Table } from "./Table";

export function JokerApp() {
  const { game, secondsLeft, kicked, start, quit, bid, pickTrump, play } = useJokerGame();
  if (!game) return <Setup onStart={start} kicked={kicked} />;
  return (
    <Table
      game={game}
      secondsLeft={secondsLeft}
      onBid={bid}
      onTrump={pickTrump}
      onPlay={play}
      onQuit={quit}
    />
  );
}
