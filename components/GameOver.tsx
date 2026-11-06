"use client";

import Link from "next/link";
import { useState } from "react";
import { tt } from "@/lib/i18n";
import { PLAYERS, type GameState } from "@/lib/joker/engine";
import { HUMAN } from "@/lib/joker/useGame";
import { Avatar } from "./Avatar";
import { END_REACTIONS, type EndReaction } from "@/lib/online/endReactions";
import { Nick } from "./Nick";
import { usePlayerAvatars, usePlayerNames } from "./names";
import type { TrickLog } from "@/lib/joker/trickLog";
import { ScoreSheet } from "./ScoreSheet";
import { GameStats } from "./GameStats";
import { PlayerHands } from "./TrickDetail";

/** Colours and symbols of the bots when there are no real players' pictures. */
const BOT_LOOK = [
  { color: "amber", icon: "★" },
  { color: "sky", icon: "♠" },
  { color: "rose", icon: "♥" },
  { color: "violet", icon: "♦" },
];

/** What each player did over the whole game, from the sheet: bids that came true, khishtis, the best hand. */
function summarize(game: GameState, p: number) {
  const hands = game.history.length;
  const hits = game.history.filter((h) => h.bids[p] === h.taken[p]).length;
  const khishtis = game.history.filter((h) => (h.bids[p] ?? 0) > 0 && h.taken[p] === 0).length;
  const best = game.history.reduce((m, h) => Math.max(m, h.points[p]), 0);
  return { hands, hits, khishtis, best };
}

/**
 * The end of a game, on a page of its own (the table is gone): who came where and with how many points,
 * what the game gave (rating, coins) and the buttons. The full score sheet is one tap away.
 */
export function GameOver({
  game,
  sums,
  note,
  onNew,
  rematch,
  onReact,
  reactions,
  shareLink,
  tricks = [],
}: {
  game: GameState;
  sums: number[];
  /** What the game gave (rating, coins): drawn under the places. */
  note?: React.ReactNode;
  onNew: () => void;
  /** Online: the button that opens a new table with the same players. */
  rematch?: React.ReactNode;
  /** Online: sends a quick reaction ("GG"); `reactions` are the ones just received, by seat. */
  onReact?: (code: EndReaction) => void;
  reactions?: Record<number, EndReaction>;
  /** Online: the invite link that goes with the shared result. */
  shareLink?: string | null;
  /** The tricks this player saw, for the details of each hand and player. */
  tricks?: TrickLog[];
}) {
  const [openPlayer, setOpenPlayer] = useState<number | null>(null);
  const names = usePlayerNames();
  const avatars = usePlayerAvatars();

  // Places: equal scores share one (two players on 100 are both second).
  const place = (p: number) => 1 + sums.filter((s) => s > sums[p]).length;
  const order = Array.from({ length: PLAYERS }, (_, p) => p).sort((a, b) => sums[b] - sums[a] || a - b);
  const mine = place(HUMAN);

  const share = async () => {
    const text = tt(
      `ProJoker-ზე ჯოკერში ${mine} ადგილზე გავედი (${sums[HUMAN]} ქულა)! ითამაშე ჩემთან ერთად:`,
      `I came ${mine}${mine === 1 ? "st" : mine === 2 ? "nd" : mine === 3 ? "rd" : "th"} in Joker on ProJoker (${sums[HUMAN]} points)! Play with me:`,
      `В Джокере на ProJoker я занял ${mine} место (${sums[HUMAN]} очков)! Сыграй со мной:`,
    );
    const url = shareLink ?? window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({ title: "ProJoker", text, url });
        return;
      } catch {
        /* closed without sharing */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
    } catch {
      window.prompt(tt("დააკოპირეთ", "Copy this", "Скопируйте"), `${text} ${url}`);
    }
  };

  return (
    <div className="pk-scroll fixed inset-0 z-30 overflow-y-auto bg-[radial-gradient(ellipse_at_50%_-10%,var(--bg-a),var(--bg-b)_70%)]">
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center gap-8 px-5 py-10">
        <header className="flex flex-col gap-2 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/45">{tt("თამაში დასრულდა", "Game over", "Игра окончена")}</p>
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
            {mine === 1
              ? tt("თქვენ გაიმარჯვეთ", "You won", "Вы победили")
              : tt(`თქვენი ადგილი: ${mine}`, `You came ${mine}${mine === 2 ? "nd" : mine === 3 ? "rd" : "th"}`, `Ваше место: ${mine}`)}
          </h1>
        </header>

        <ol className="flex flex-col gap-2">
          {order.map((p) => {
            const pl = place(p);
            const photo = avatars?.[p];
            const bot = BOT_LOOK[p];
            const first = pl === 1;
            return (
              <li
                key={p}
                className={`rounded-2xl border ${
                  first ? "border-amber-300/60 bg-amber-300/10" : p === HUMAN ? "border-white/25 bg-white/[0.07]" : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenPlayer((o) => (o === p ? null : p))}
                  aria-expanded={openPlayer === p}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left"
                >
                <span className={`w-6 text-center text-xl font-extrabold tabular-nums ${first ? "text-amber-300" : "text-white/45"}`}>{pl}</span>
                <Avatar size="sm" color={photo?.color ?? bot.color} icon={photo?.icon ?? bot.icon} url={photo?.url} frame={photo?.frame} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-lg leading-tight">
                    <Nick name={names[p]} style={photo?.nick} />
                  </b>
                  <span className="truncate text-xs text-white/45">
                    {(() => {
                      const s = summarize(game, p);
                      return tt(
                        `წაიღო თავისი ${s.hits}/${s.hands} · ხიშტი ${s.khishtis} · საუკეთესო ${s.best > 0 ? "+" : ""}${s.best}`,
                        `hit ${s.hits}/${s.hands} · khishti ${s.khishtis} · best ${s.best > 0 ? "+" : ""}${s.best}`,
                        `угадал ${s.hits}/${s.hands} · хишти ${s.khishtis} · лучший ${s.best > 0 ? "+" : ""}${s.best}`,
                      );
                    })()}
                  </span>
                </span>
                {reactions?.[p] && (
                  <span className="reaction-pop rounded-full bg-white/10 px-2.5 py-0.5 text-sm font-extrabold">{reactions[p]}</span>
                )}
                  <span className={`text-2xl font-extrabold tabular-nums ${sums[p] < 0 ? "text-red-300" : first ? "text-amber-300" : ""}`}>{sums[p]}</span>
                  <span className={`text-white/40 transition-transform ${openPlayer === p ? "rotate-180" : ""}`} aria-hidden>
                    ▾
                  </span>
                </button>
                {openPlayer === p && (
                  <div className="px-2 pb-2">
                    <PlayerHands game={game} player={p} tricks={tricks} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {note && <div className="text-center text-sm text-white/60">{note}</div>}

        {onReact && (
          <div className="flex flex-wrap items-center justify-center gap-2" aria-label={tt("სწრაფი რეაქცია", "Quick reaction", "Быстрая реакция")}>
            {END_REACTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onReact(r)}
                className="rounded-full border border-white/15 bg-white/[0.05] px-4 py-1.5 text-base font-extrabold transition-colors hover:border-amber-300/60 hover:bg-white/10"
              >
                {r}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {rematch}
          <button className={`btn w-full ${rematch ? "" : "btn-primary"}`} onClick={onNew}>
            {tt("ახალი თამაში", "New game", "Новая игра")}
          </button>
          <Link href="/" className="btn block w-full text-center">
            {tt("მთავარი მენიუ", "Main menu", "Главное меню")}
          </Link>
        </div>

        {onReact && (
          <button type="button" onClick={() => void share()} className="mx-auto -mt-3 text-sm font-bold text-white/50 transition-colors hover:text-amber-300">
            {tt("შედეგის გაზიარება", "Share the result", "Поделиться результатом")} ↗
          </button>
        )}

        <details className="group">
          <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-bold text-white/50 transition-colors hover:text-white">
            {tt("სტატისტიკა", "Statistics", "Статистика")}
            <span className="transition-transform group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </summary>
          <div className="mt-3">
            <GameStats game={game} tricks={tricks} />
          </div>
        </details>

        <details className="group">
          <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-bold text-white/50 transition-colors hover:text-white">
            {tt("ქულების ფურცელი", "Score sheet", "Таблица очков")}
            <span className="transition-transform group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </summary>
          <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-2">
            <ScoreSheet game={game} tricks={tricks} className="max-h-[55vh]" />
          </div>
        </details>
      </div>
    </div>
  );
}
