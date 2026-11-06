"use client";

import { useAuth } from "@/lib/auth/AuthProvider";
import { isDeveloper } from "@/lib/dev";
import { useT } from "@/lib/i18n";
import { useTrickLog } from "@/lib/joker/trickLog";
import { useJokerGame } from "@/lib/joker/useGame";
import { PlayerNamesProvider, useMe } from "./names";
import { Setup } from "./Setup";
import { Table } from "./Table";
import { BotChat } from "./TableChat";

/** A game against bots: nothing is rated and nothing is recorded anywhere. */
export function JokerApp() {
  const { game, secondsLeft, kicked, bots, start, quit, finishNow, bid, pickTrump, play } = useJokerGame();
  const { user } = useAuth();
  const tricks = useTrickLog(game);
  const me = useMe();
  const t = useT();
  if (!game) return <Setup onStart={start} kicked={kicked} />;
  return (
    <PlayerNamesProvider
      names={[me.name, ...bots.map((b) => b.name)]}
      avatars={[me.avatar, ...bots.map((b) => ({ color: b.color, icon: b.icon }))]}
    >
      <BotChat myId="me" bots={bots.map((b) => b.name)} />
      {isDeveloper(user) && game.phase !== "gameEnd" && (
        <button
          type="button"
          onClick={finishNow}
          className="fixed bottom-20 left-3 z-40 rounded-full border border-dashed border-fuchsia-300/60 bg-fuchsia-500/20 px-3 py-1.5 text-xs font-extrabold text-fuchsia-100 backdrop-blur hover:bg-fuchsia-500/35"
        >
          DEV · დასრულება
        </button>
      )}
      <Table
        game={game}
        secondsLeft={secondsLeft}
        onBid={bid}
        onTrump={pickTrump}
        onPlay={play}
        onQuit={quit}
        tricks={tricks}
        endNote={<span className="text-white/60">{t("თამაში ბოტებთან არ იწერება ისტორიაში", "Games vs bots are not recorded in the history", "Игры с ботами не записываются в историю")}</span>}
      />
    </PlayerNamesProvider>
  );
}
