"use client";

import { useJokerGame } from "@/lib/joker/useGame";
import { PlayerNamesProvider, useMe } from "./names";
import { Setup } from "./Setup";
import { Table } from "./Table";
import { BotChat } from "./TableChat";

/** A game against bots: nothing is rated and nothing is recorded anywhere. */
export function JokerApp() {
  const { game, secondsLeft, kicked, bots, start, quit, bid, pickTrump, play } = useJokerGame();
  const me = useMe();
  if (!game) return <Setup onStart={start} kicked={kicked} />;
  return (
    <PlayerNamesProvider
      names={[me.name, ...bots.map((b) => b.name)]}
      avatars={[me.avatar, ...bots.map((b) => ({ color: b.color, icon: b.icon }))]}
    >
      <BotChat myId="me" bots={bots.map((b) => b.name)} />
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
