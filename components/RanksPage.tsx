"use client";

import { useT } from "@/lib/i18n";
import { RANKS } from "@/lib/ranks";
import { PageShell } from "./PageShell";
import { RankEmblem } from "./RankEmblem";
import { rise } from "./ui";

/** The whole ladder, from the first shield to the Joker. */
export function RanksPage() {
  const t = useT();
  return (
    <PageShell width="max-w-4xl">
      <section className="flex flex-col gap-2" style={rise(1)}>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">{t("წოდებები", "Ranks", "Ранги")}</h1>
        <p className="text-lg text-white/55">
          {t("ყველა იწყებს 50 ქულით. რეიტინგული თამაშის მერე ქულა იზრდება ან მცირდება, წოდებაც მას მიჰყვება.", "Everyone starts with 50 points. After a ranked game your points go up or down, and your rank follows.", "Все начинают с 50 очков. После рейтинговой игры очки растут или падают, а ранг следует за ними.")}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 pb-8 sm:grid-cols-3" style={rise(2)}>
        {RANKS.map((r) => (
          <div
            key={r.name}
            className="flex flex-col items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-7 text-center"
            style={r.star ? { borderColor: `${r.accent}66`, background: `${r.accent}14` } : undefined}
          >
            <RankEmblem rank={r} className="size-24 sm:size-28" />
            <b className="text-xl font-extrabold" style={{ color: r.accent }}>
              {r.name}
            </b>
            <span className="text-sm text-white/50">{t(`${r.min} ქულიდან`, `from ${r.min} points`, `от ${r.min} очков`)}</span>
          </div>
        ))}
      </section>
    </PageShell>
  );
}
