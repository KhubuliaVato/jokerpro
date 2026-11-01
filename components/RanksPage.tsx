"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useT } from "@/lib/i18n";
import { rankFor, RANKS, type Rank } from "@/lib/ranks";
import { loadRating } from "@/lib/ratings";
import { getSupabase } from "@/lib/supabase";
import { PageShell } from "./PageShell";
import { RankEmblem } from "./RankEmblem";
import { rise } from "./ui";

type Mine = Partial<Record<"joker" | "bura", number>>;

/** The whole ladder, from the first shield to the GrandMaster, with the player's own place on it. */
export function RanksPage() {
  const { user } = useAuth();
  const t = useT();
  const [loaded, setLoaded] = useState<{ userId: string; mine: Mine } | null>(null);

  const userId = user?.id ?? null;
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    Promise.all([loadRating(supabase, userId, "joker"), loadRating(supabase, userId, "bura")]).then(([joker, bura]) => {
      if (!cancelled) setLoaded({ userId, mine: { joker: joker?.rating, bura: bura?.rating } });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  const mine = loaded && loaded.userId === userId ? loaded.mine : null;

  // which games stand on which rank: shown as small tags on that rank's card
  const here = new Map<number, string[]>();
  if (mine) {
    for (const g of ["joker", "bura"] as const) {
      const rating = mine[g];
      if (rating === undefined) continue;
      const idx = rankFor(rating).rank.index;
      here.set(idx, [...(here.get(idx) ?? []), g === "joker" ? t("ჯოკერი", "Joker", "Джокер") : t("ბურა", "Bura", "Бура")]);
    }
  }

  const top = RANKS[RANKS.length - 1];
  const ladder = RANKS.slice(0, -1);

  return (
    <PageShell width="max-w-6xl" glow={top.accent}>
      <section className="flex flex-col gap-3" style={rise(1)}>
        <h1 className="text-[clamp(1.8rem,9vw,2.4rem)] font-extrabold tracking-tight sm:text-5xl">{t("წოდებები", "Ranks", "Ранги")}</h1>
        <p className="hidden max-w-2xl text-base text-white/55 sm:block sm:text-lg">
          {t(
            "ყველა იწყებს 50 ქულით. რეიტინგული თამაშის მერე ქულა იზრდება ან მცირდება, წოდებაც მას მიჰყვება.",
            "Everyone starts with 50 points. After a ranked game your points go up or down, and your rank follows.",
            "Все начинают с 50 очков. После рейтинговой игры очки растут или падают, а ранг следует за ними.",
          )}
        </p>
      </section>

      {/* the whole ladder fits one screen: the other eight in two rows, the GrandMaster at the end */}
      <section className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-stretch" style={rise(2)}>
        <div className="grid flex-1 grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-4">
          {ladder.map((r) => (
            <RankCard key={r.name} rank={r} next={RANKS[r.index + 1]} tags={here.get(r.index)} />
          ))}
        </div>
        <GrandCard rank={top} tags={here.get(top.index)} />
      </section>

      {!user && (
        <p className="text-center text-white/55" style={rise(3)}>
          <Link href="/login?next=%2Franks" className="font-bold text-amber-300 hover:underline">
            {t("შედით", "Sign in", "Войдите")}
          </Link>{" "}
          {t("და ნახეთ, რომელ წოდებაზე ხართ", "to see where you stand", "и посмотрите, на каком вы ранге")}
        </p>
      )}
      
    </PageShell>
  );
}

function pointsText(t: ReturnType<typeof useT>, r: Rank, next?: Rank) {
  return next
    ? t(`${r.min}-${next.min - 1} ქულა`, `${r.min}-${next.min - 1} points`, `${r.min}-${next.min - 1} очков`)
    : t(`${r.min}+ ქულა`, `${r.min}+ points`, `${r.min}+ очков`);
}

function RankCard({ rank, next, tags }: { rank: Rank; next?: Rank; tags?: string[] }) {
  const t = useT();
  const mineHere = !!tags?.length;
  return (
    <div
      className="group relative flex flex-col items-center justify-center gap-1 rounded-2xl border bg-gradient-to-b from-white/[0.08] to-white/[0.02] px-2 py-2.5 text-center shadow-[0_14px_30px_-22px_rgb(0_0_0/0.8)] transition-[translate,border-color] duration-300 ease-out hover:-translate-y-1 sm:gap-1.5 sm:px-3 sm:py-5"
      style={{ borderColor: mineHere ? rank.accent : `${rank.accent}33` }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="absolute -top-10 left-1/2 size-36 -translate-x-1/2 rounded-full blur-3xl" style={{ background: `${rank.accent}${mineHere ? "55" : "33"}` }} />
      </div>
      <span className="absolute left-2.5 top-1.5 text-[0.65rem] font-black tabular-nums text-white/25 sm:left-3 sm:top-2 sm:text-xs">{String(rank.index + 1).padStart(2, "0")}</span>
      <div className="relative transition-transform duration-300 group-hover:scale-110">
        <RankEmblem rank={rank} className="size-[3.6rem] sm:size-[5.5rem] lg:size-28" />
      </div>
      <b className="relative text-sm font-extrabold sm:text-lg" style={{ color: rank.accent }}>
        {rank.name}
      </b>
      <span className="relative text-[0.7rem] text-white/55 sm:text-sm">{pointsText(t, rank, next)}</span>
      {mineHere && (
        <span className="relative mt-0.5 rounded-full px-2 py-0.5 text-[0.6rem] font-extrabold leading-tight text-black sm:text-xs" style={{ background: rank.accent }}>
          {t("თქვენ აქ ხართ", "You are here", "Вы здесь")}
        </span>
      )}
    </div>
  );
}

/** The top of the ladder gets a tall card of its own. */
function GrandCard({ rank, tags }: { rank: Rank; tags?: string[] }) {
  const t = useT();
  const mineHere = !!tags?.length;
  return (
    <div
      className="group relative flex flex-none flex-row items-center gap-4 rounded-3xl border bg-gradient-to-br from-white/[0.1] to-white/[0.02] px-5 py-4 lg:w-72 lg:flex-col lg:justify-center lg:gap-3 lg:px-6 lg:py-8 lg:text-center"
      style={{ borderColor: `${rank.accent}${mineHere ? "ff" : "88"}`, boxShadow: `0 30px 70px -30px ${rank.accent}99` }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="absolute -left-10 -top-16 size-72 rounded-full blur-3xl" style={{ background: `${rank.accent}55` }} />
        <div className="absolute -bottom-24 right-0 size-64 rounded-full blur-3xl" style={{ background: `${rank.accent}33` }} />
      </div>
      <div className="relative flex-none transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-2">
        <RankEmblem rank={rank} className="size-24 sm:size-28 lg:size-60" />
      </div>
      <div className="relative flex min-w-0 flex-col gap-1 lg:items-center">
        <span className="text-xs font-black tabular-nums text-white/35">{String(rank.index + 1).padStart(2, "0")} · {t("უმაღლესი წოდება", "Highest rank", "Высший ранг")}</span>
        <b className="text-3xl font-black tracking-tight sm:text-4xl" style={{ color: rank.accent }}>
          {rank.name}
        </b>
        <span className="text-base text-white/65">{t(`${rank.min}+ ქულა`, `${rank.min}+ points`, `${rank.min}+ очков`)}</span>
        {mineHere && (
          <span className="mt-1 w-fit rounded-full px-3 py-1 text-xs font-extrabold text-black" style={{ background: rank.accent }}>
            {t("თქვენ აქ ხართ", "You are here", "Вы здесь")}
          </span>
        )}
      </div>
    </div>
  );
}
