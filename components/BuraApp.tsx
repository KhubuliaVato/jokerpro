"use client";

import { useT } from "@/lib/i18n";
import { useState } from "react";
import { botById, DEFAULT_BOTS } from "@/lib/joker/botProfiles";
import type { BuraPlayers } from "@/lib/bura/engine";
import { useBuraGame } from "@/lib/bura/useGame";
import { BotPicker } from "./BotPicker";
import { BuraTable } from "./BuraTable";
import { PageShell } from "./PageShell";
import { BotChat } from "./TableChat";
import { BTN_PRIMARY, rise } from "./ui";

/** A game of Bura against bots: nothing is rated and nothing is recorded anywhere. */
export function BuraApp() {
  const { game, bots, secondsLeft, kicked, start, quit, next, play, doAct } = useBuraGame();
  const t = useT();
  const [players, setPlayers] = useState<BuraPlayers>(2);
  // (fixed to begin with: a random pick would differ between the server's page and the browser's)
  const [picked, setPicked] = useState<Record<BuraPlayers, string[]>>({ 2: ["levani"], 4: DEFAULT_BOTS });
  const opponents = picked[players];

  if (game) {
    return (
      <>
        <BotChat myId="me" bots={bots.map((b) => b.name)} />
        <BuraTable
          game={game}
          secondsLeft={secondsLeft}
          names={[t("თქვენ", "You", "Вы"), ...bots.map((b) => b.name)]}
          avatars={[null, ...bots.map((b) => ({ color: b.color, icon: b.icon }))]}
          onPlay={play}
          onAct={doAct}
          onNext={next}
          autoNext
          onQuit={quit}
          endNote={<span className="text-white/60">{t("თამაში ბოტებთან არ იწერება ისტორიაში", "Games vs bots are not recorded in the history", "Игры с ботами не записываются в историю")}</span>}
        />
      </>
    );
  }

  return (
    <PageShell width="max-w-3xl">
      <section className="flex flex-col gap-2" style={rise(1)}>
        <p className="text-sm font-bold uppercase tracking-wider text-white/45">{t("ბურა", "Bura", "Бура")}</p>
        <h1 className="text-[clamp(1.8rem,11.5vw,3rem)] font-extrabold tracking-tight sm:text-7xl">{t("ბოტებთან", "Vs bots", "С ботами")}</h1>
        <p className="text-lg text-white/55 sm:text-xl">{t("სავარჯიშო თამაში: ქულა და ისტორია არ იწერება", "Practice game: points and history are not recorded", "Тренировочная игра: очки и история не записываются")}</p>
      </section>

      {kicked && (
        <p role="alert" className="rounded-2xl border border-red-400/40 bg-red-500/10 px-5 py-4 text-red-200" style={rise(1)}>
          {t("ზედიზედ ორჯერ გამოტოვეთ სვლა და თამაშიდან გაგაგდეთ.", "You missed your turn twice in a row and were removed from the game.", "Вы дважды подряд пропустили ход и были исключены из игры.")}
        </p>
      )}

      <div className="flex flex-col gap-10" style={rise(2)}>
        <div className="grid grid-cols-2 gap-4">
          {([2, 4] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPlayers(n)}
              aria-pressed={players === n}
              className={`rounded-2xl border p-5 text-left transition-[border-color,background-color,translate] duration-200 hover:-translate-y-0.5 ${
                players === n ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-white/[0.03] hover:border-white/30"
              }`}
            >
              <b className="block text-3xl">{n}</b>
              <span className="text-white/55">{n === 2 ? t("მოთამაშე", "player", "игрок") : t("მოთამაშე · 2×2", "players · 2×2", "игрока · 2×2")}</span>
            </button>
          ))}
        </div>
        <BotPicker
          selected={opponents}
          count={players - 1}
          onChange={(ids) => setPicked((p) => ({ ...p, [players]: ids }))}
        />
      </div>

      <div className="pb-8" style={rise(3)}>
        <button
          className={`${BTN_PRIMARY} w-full !py-4 !text-xl`}
          disabled={opponents.length !== players - 1}
          onClick={() => start(players, opponents.map(botById))}
        >
          {opponents.length === players - 1 ? t("თამაშის დაწყება →", "Start the game →", "Начать игру →") : t(`აირჩიეთ ${players - 1} ოპონენტი`, `Choose ${players - 1} opponent${players - 1 > 1 ? "s" : ""}`, `Выберите соперников: ${players - 1}`)}
        </button>
      </div>
    </PageShell>
  );
}
