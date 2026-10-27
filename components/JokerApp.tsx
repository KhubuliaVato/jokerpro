"use client";

import { useJokerGame } from "@/lib/joker/useGame";
import { PlayerNamesProvider } from "./names";
import { Setup } from "./Setup";
import { Table } from "./Table";

/** A game against bots: nothing is rated and nothing is recorded anywhere. */
export function JokerApp() {
  const { game, secondsLeft, kicked, bots, start, quit, bid, pickTrump, play } = useJokerGame();
  if (!game) return <Setup onStart={start} kicked={kicked} />;
  return (
    <PlayerNamesProvider
      names={["თქვენ", ...bots.map((b) => b.name)]}
      avatars={[null, ...bots.map((b) => ({ color: b.color, icon: b.icon }))]}
    >
      <Table
        game={game}
        secondsLeft={secondsLeft}
        onBid={bid}
        onTrump={pickTrump}
        onPlay={play}
        onQuit={quit}
        endNote={<span className="text-white/60">თამაში ბოტებთან არ იწერება ისტორიაში</span>}
      />
    </PlayerNamesProvider>
  );
}
