"use client";

import { useT } from "@/lib/i18n";
import { useState } from "react";
import { botById, DEFAULT_BOTS, type BotProfile } from "@/lib/joker/botProfiles";
import { DEFAULT_RULES, type Rules } from "@/lib/joker/rules";
import { BotPicker } from "./BotPicker";
import { PageShell } from "./PageShell";
import { RulesAccordion, RulesForm } from "./RulesForm";
import { BTN_PRIMARY, rise } from "./ui";

/** Setup of a game against bots: nothing is rated and nothing is recorded. */
export function Setup({
  onStart,
  kicked,
}: {
  onStart: (rules: Rules, opponents: BotProfile[]) => void;
  kicked?: boolean;
}) {
  const t = useT();
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [opponents, setOpponents] = useState<string[]>(DEFAULT_BOTS);
  const set = (patch: Partial<Rules>) => setRules((r) => ({ ...r, ...patch }));

  return (
    <PageShell width="max-w-3xl">
      <section className="flex flex-col gap-2" style={rise(1)}>
        <p className="text-sm font-bold uppercase tracking-wider text-white/45">{t("ჯოკერი", "Joker", "Джокер")}</p>
        <h1 className="text-[clamp(1.8rem,11.5vw,3rem)] font-extrabold tracking-tight sm:text-7xl">{t("ბოტებთან", "Vs bots", "С ботами")}</h1>
        <p className="text-lg text-white/55 sm:text-xl">{t("სავარჯიშო თამაში: ქულა და ისტორია არ იწერება", "Practice game: points and history are not recorded", "Тренировочная игра: очки и история не записываются")}</p>
      </section>

      {kicked && (
        <p
          role="alert"
          className="rounded-2xl border border-red-400/40 bg-red-500/10 px-5 py-4 text-red-200"
          style={rise(1)}
        >
          {t("ზედიზედ ორჯერ გამოტოვეთ სვლა და თამაშიდან გაგაგდეთ.", "You missed your turn twice in a row and were removed from the game.", "Вы дважды подряд пропустили ход и были исключены из игры.")}
        </p>
      )}

      <div className="flex flex-col gap-10" style={rise(2)}>
        <BotPicker selected={opponents} onChange={setOpponents} />
        <RulesForm rules={rules} onChange={set} />
      </div>

      <div className="flex flex-col gap-6 pb-8" style={rise(3)}>
        <button
          className={`${BTN_PRIMARY} w-full !py-4 !text-xl`}
          disabled={opponents.length !== 3}
          onClick={() => onStart(rules, opponents.map(botById))}
        >
          {opponents.length === 3 ? t("თამაშის დაწყება →", "Start the game →", "Начать игру →") : t("აირჩიეთ 3 ოპონენტი", "Choose 3 opponents", "Выберите 3 соперников")}
        </button>
        <RulesAccordion />
      </div>
    </PageShell>
  );
}
