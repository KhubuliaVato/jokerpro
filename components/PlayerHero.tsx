"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { rankFor } from "@/lib/ranks";
import type { RatingRow } from "@/lib/ratings";
import type { PlayerSummary } from "@/lib/search";
import { Avatar } from "./Avatar";
import { RankEmblem } from "./RankEmblem";
import { HEADER_BTN, rise } from "./ui";

/** A button that copies the link to a player's public page. */
function CopyLink({ id }: { id: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/players/${id}`);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      // clipboard blocked: nothing to copy to
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={t("ბმულის კოპირება", "Copy link", "Копировать ссылку")}
      className={`flex h-11 items-center gap-2 px-4 text-sm font-bold ${HEADER_BTN} ${done ? "!border-emerald-400/60 text-emerald-300" : "text-white/75"}`}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {done ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />}
      </svg>
      {done ? t("დაკოპირდა", "Copied", "Скопировано") : t("ბმული", "Share", "Ссылка")}
    </button>
  );
}

/**
 * The top card of a player's page: photo, name, membership date, and the player's rank in the chosen game
 * (a shield with a ring that fills toward the next rank). `actions` are the player's own controls.
 */
export function PlayerHero({
  player,
  subtitle,
  rating,
  position,
  gameSwitch,
  actions,
}: {
  player: PlayerSummary | null;
  /** Shown before the membership date (e.g. the e-mail on one's own profile). */
  subtitle?: string;
  /** The rating of the chosen game; null for a player without a ranked game. */
  rating: RatingRow | null;
  position: number | null;
  /** The game pills: the rank on the card belongs to the chosen game. */
  gameSwitch: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const t = useT();
  const points = rating?.rating ?? 50;
  const { rank, next, progress, toNext } = rankFor(points);
  return (
    <section
      className="relative rounded-[2rem] border bg-gradient-to-br from-white/[0.09] to-white/[0.02] p-5 sm:p-8"
      style={{ borderColor: `${rank.accent}44`, boxShadow: `0 30px 80px -40px ${rank.accent}`, ...rise(1) }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="absolute -right-20 -top-24 size-96 rounded-full blur-3xl transition-[background] duration-500" style={{ background: `${rank.accent}30` }} />
        <div className="absolute -left-16 bottom-[-7rem] size-72 rounded-full bg-amber-300/10 blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="flex min-w-0 flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          <div className="relative flex-none">
            <div className="absolute inset-0 scale-125 rounded-full bg-amber-300/20 blur-2xl" />
            <div className="relative rounded-full p-1 max-sm:[&>*]:size-24! max-sm:[&>*]:text-5xl!" style={{ background: `linear-gradient(160deg, ${rank.accent}, ${rank.accent}33)` }}>
              <Avatar size="xl" color={player?.avatar_color} icon={player?.avatar_icon} url={player?.avatar_url} />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="truncate pb-1.5 text-4xl font-extrabold leading-[1.2] tracking-tight sm:text-5xl">{player?.nickname ?? "…"}</h1>
            <p className="mt-1 text-base text-white/50">
              {subtitle && <span className="block truncate">{subtitle}</span>}
              {player && <span className="block">{t(`წევრია ${formatDate(new Date(player.created_at))}-დან`, `Member since ${formatDate(new Date(player.created_at))}`, `Участник с ${formatDate(new Date(player.created_at))}`)}</span>}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {player && <CopyLink id={player.id} />}
              {actions}
            </div>
          </div>
        </div>

        <div className="flex flex-none items-center justify-center gap-5 rounded-3xl bg-black/20 p-4 sm:p-5">
          <div className={rating ? "" : "opacity-50 grayscale"}>
            <RankEmblem rank={rank} className="size-28 sm:size-32" progress={next ? progress : 1} />
          </div>
          <div className="min-w-[11rem]">
            <b className="block text-3xl font-extrabold leading-tight" style={{ color: rank.accent }}>
              {rank.name}
            </b>
            <span className="text-2xl font-black tabular-nums">{rating ? points : "—"}</span>
            <span className="ml-1.5 text-sm text-white/45">{t("ქულა", "points", "очков")}</span>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${Math.round(progress * 100)}%`, background: `linear-gradient(90deg, ${rank.metal[1]}, ${rank.accent})` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-white/50">
              {next ? t(`${next.name}-მდე ${toNext} ქულა`, `${toNext} pts to ${next.name}`, `${toNext} очк. до ${next.name}`) : t("უმაღლესი წოდება", "Top rank", "Высший ранг")}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {position !== null && (
                <Link href="/leaderboard" className="rounded-full border border-white/15 px-3 py-1 text-xs font-bold transition-colors hover:border-amber-300 hover:text-amber-300">
                  {t("ადგილი", "Place", "Место")} #{position}
                </Link>
              )}
              {rating && <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">{t("საუკეთესო", "Best", "Лучший")} {rating.peak}</span>}
              {!rating && <span className="text-xs text-white/45">{t("ჯერ რეიტინგული თამაში არ აქვს", "No ranked game yet", "Пока нет рейтинговых игр")}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-6 border-t border-white/10 pt-5">{gameSwitch}</div>
    </section>
  );
}
