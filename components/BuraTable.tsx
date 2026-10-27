"use client";

import { useEffect, useRef, useState } from "react";
import { isRed, SUIT_SYMBOL, sortHand, type NormalCard } from "@/lib/joker/cards";
import { isLegal, legalPlays, teamOf, type BuraState } from "@/lib/bura/engine";
import { playCardSound, playDealSound } from "@/lib/sound";
import { Avatar } from "./Avatar";
import { CardView } from "./CardView";
import type { SeatAvatar } from "./names";
import { BTN_GHOST, BTN_PRIMARY } from "./ui";

interface Props {
  game: BuraState;
  secondsLeft: number | null;
  /** Seat 0 is you; the rest go clockwise. */
  names: string[];
  avatars: (SeatAvatar | null)[];
  onPlay: (ids: string[]) => void;
  /** Starts the next round (bots game: the human decides when). */
  onNext: () => void;
  /** Online: the server deals the next round by itself, so there is no button for it. */
  autoNext?: boolean;
  onQuit: () => void;
  /** Shown under the final result (e.g. whether it was saved). */
  endNote?: React.ReactNode;
  quitConfirm?: string;
}

const HAND_CW = "clamp(3.4rem, min(15vw, 12dvh), 6rem)";
const TRICK_CW = "clamp(2.7rem, min(11vw, 9.5dvh), 4.6rem)";
const OPP_CW = "clamp(1.7rem, min(6vw, 5.5dvh), 2.6rem)";
const cw = (v: string) => ({ ["--cw" as string]: v }) as React.CSSProperties;

/** Where a seat sits on screen: you at the bottom, then clockwise (two players: you and the one across). */
function spot(game: BuraState, seat: number): "bottom" | "left" | "top" | "right" {
  if (game.players === 2) return seat === 0 ? "bottom" : "top";
  return (["bottom", "left", "top", "right"] as const)[seat];
}

const TRICK_AT: Record<string, string> = {
  bottom: "left-1/2 top-[64%] -translate-x-1/2 -translate-y-1/2",
  top: "left-1/2 top-[36%] -translate-x-1/2 -translate-y-1/2",
  left: "left-[32%] top-1/2 -translate-x-1/2 -translate-y-1/2",
  right: "left-[68%] top-1/2 -translate-x-1/2 -translate-y-1/2",
};

export function BuraTable({ game, secondsLeft, names, avatars, onPlay, onNext, autoNext, onQuit, endNote, quitConfirm }: Props) {
  const [confirm, setConfirm] = useState(false);
  const over = game.phase === "roundEnd" || game.phase === "gameEnd";
  const teams = game.players === 4;

  // A sound for every card that lands on the table, and for a fresh deal.
  const onTable = game.trick.reduce((n, p) => n + p.cards.length, 0);
  const before = useRef({ onTable, round: game.round });
  useEffect(() => {
    if (before.current.round !== game.round) playDealSound();
    else if (onTable > before.current.onTable) playCardSound();
    before.current = { onTable, round: game.round };
  }, [onTable, game.round]);

  const turnSpot = game.phase === "play" ? spot(game, game.turn) : null;
  const winnerSpot = game.phase === "trickEnd" ? spot(game, game.trick[game.best].player) : null;

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,#1b6b46,#0a2a1b_78%)] text-white select-none">
      {/* score */}
      <header className="relative z-20 flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 text-sm sm:text-base">
          <ScoreChip label={teams ? "ჩვენ" : "თქვენ"} value={game.scores[0]} target={game.target} mine />
          <ScoreChip label={teams ? "ისინი" : names[1]} value={game.scores[1]} target={game.target} />
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-black/30 px-3 py-1.5 text-sm font-bold text-amber-200" title="თქვენი რაუნდის ქულა">
            {game.piles[0]} ქულა
          </span>
          {confirm ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="hidden max-w-xs text-white/70 sm:inline">{quitConfirm ?? "დარწმუნებული ხართ?"}</span>
              <button className="rounded-full bg-red-500/80 px-3 py-1.5 font-bold" onClick={onQuit}>
                გასვლა
              </button>
              <button className="rounded-full bg-white/10 px-3 py-1.5 font-bold" onClick={() => setConfirm(false)}>
                დარჩენა
              </button>
            </span>
          ) : (
            <button className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-white/70 hover:bg-white/20" onClick={() => setConfirm(true)}>
              გასვლა
            </button>
          )}
        </div>
      </header>

      {/* the table */}
      <div className="relative min-h-0 flex-1">
        {Array.from({ length: game.players }, (_, seat) => seat)
          .filter((seat) => seat !== 0)
          .map((seat) => (
            <Opponent
              key={seat}
              where={spot(game, seat) as "left" | "top" | "right"}
              name={names[seat] ?? "…"}
              avatar={avatars[seat]}
              cards={game.hands[seat].length}
              active={turnSpot === spot(game, seat)}
              partner={teams && teamOf(seat) === 0}
            />
          ))}

        {/* trump and pile */}
        <div className="absolute left-3 top-2 z-10 flex items-center gap-3 sm:left-6">
          <div className="relative" style={{ ...cw(TRICK_CW), width: "calc(var(--cw) * 2.1)", height: "calc(var(--cw) * 1.4)" }}>
            {game.deck.length > 0 && (
              <>
                {/* the trump card lies face up, tucked under the pile */}
                <div className="absolute top-[18%] origin-center -rotate-90" style={{ left: "calc(var(--cw) * 0.2)" }}>
                  <CardView card={game.trumpCard} style={cw(TRICK_CW)} />
                </div>
                <div className="absolute right-0 top-0">
                  <CardView style={cw(TRICK_CW)} />
                </div>
              </>
            )}
          </div>
          <div className="leading-tight">
            <b className={`block text-4xl ${isRed(game.trump) ? "text-red-400" : "text-white"}`}>{SUIT_SYMBOL[game.trump]}</b>
            <span className="text-sm text-white/60">{game.deck.length} კარტი</span>
          </div>
        </div>

        {/* the trick */}
        {game.trick.map((p, i) => {
          const where = spot(game, p.player);
          const best = i === game.best;
          return (
            <div
              key={`${game.round}-${game.tricks[0] + game.tricks[1]}-${p.player}`}
              className={`absolute z-10 flex ${TRICK_AT[where]} ${winnerSpot === where && best ? "scale-105" : ""} transition-transform`}
            >
              {p.cards.map((c, k) => (
                <div key={c.id} style={{ marginLeft: k === 0 ? 0 : `calc(var(--cw) * -0.45)` }}>
                  <CardView
                    card={c}
                    style={{ ...cw(TRICK_CW), boxShadow: best ? "0 0 0 3px rgb(252 211 77), 0 6px 14px rgb(0 0 0 / .4)" : undefined }}
                  />
                </div>
              ))}
            </div>
          );
        })}

        {game.trick.length === 0 && game.phase === "play" && (
          <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-white/40">
            {game.turn === 0 ? "თქვენი სვლაა" : `${names[game.turn]} იწყებს`}
          </p>
        )}

        {over && <RoundResult game={game} names={names} onNext={onNext} autoNext={autoNext} onQuit={onQuit} endNote={endNote} />}
      </div>

      {/* my hand */}
      <Hand
        key={`${game.round}:${game.tricks[0] + game.tricks[1]}:${game.trick.length}`}
        game={game}
        active={game.phase === "play" && game.turn === 0}
        secondsLeft={secondsLeft}
        onPlay={onPlay}
      />
    </main>
  );
}

function ScoreChip({ label, value, target, mine }: { label: string; value: number; target: number; mine?: boolean }) {
  return (
    <span className={`flex items-baseline gap-2 rounded-full px-3 py-1.5 ${mine ? "bg-amber-300/15 text-amber-200" : "bg-black/30 text-white/80"}`}>
      <span className="max-w-24 truncate font-bold">{label}</span>
      <b className="text-xl tabular-nums">{value}</b>
      <span className="text-xs text-white/40">/{target}</span>
    </span>
  );
}

function Opponent({
  where,
  name,
  avatar,
  cards,
  active,
  partner,
}: {
  where: "left" | "top" | "right";
  name: string;
  avatar: SeatAvatar | null;
  cards: number;
  active: boolean;
  partner: boolean;
}) {
  const place =
    where === "top"
      ? "left-1/2 top-1 -translate-x-1/2 flex-col"
      : where === "left"
        ? "left-2 top-1/2 -translate-y-1/2 flex-col"
        : "right-2 top-1/2 -translate-y-1/2 flex-col";
  return (
    <div className={`absolute z-10 flex items-center gap-1.5 ${place}`}>
      <div className="flex items-center gap-2">
        <span className={`rounded-full transition-shadow ${active ? "shadow-[0_0_0_3px_rgb(252_211_77),0_0_18px_rgb(252_211_77/.6)]" : ""}`}>
          <Avatar size="sm" color={avatar?.color} icon={avatar?.icon} url={avatar?.url} />
        </span>
        <span className="max-w-28 truncate text-sm font-bold">
          {name}
          {partner && <span className="ml-1 text-xs text-emerald-300">გუნდელი</span>}
        </span>
      </div>
      <div className="flex">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} style={{ marginLeft: i === 0 ? 0 : `calc(var(--cw) * -0.5)` }}>
            <CardView style={cw(OPP_CW)} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** My cards, the choice of what to play, and the button. */
function Hand({
  game,
  active,
  secondsLeft,
  onPlay,
}: {
  game: BuraState;
  active: boolean;
  secondsLeft: number | null;
  onPlay: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const hand = sortHand(game.hands[0]) as NormalCard[];
  const leading = game.trick.length === 0;
  const need = leading ? null : game.trick[0].cards.length;

  const plays = active ? legalPlays(game, 0) : [];
  const reachable = new Set(
    plays.filter((p) => selected.every((id) => p.some((c) => c.id === id))).flatMap((p) => p.map((c) => c.id)),
  );
  const ready = active && selected.length > 0 && isLegal(game, selected, 0);

  const tap = (card: NormalCard) => {
    if (!active || !reachable.has(card.id)) return;
    if (need === 1) return onPlay([card.id]);
    if (selected.includes(card.id)) {
      // tapping a lone selected card again plays it
      if (leading && selected.length === 1) return onPlay([card.id]);
      return setSelected(selected.filter((id) => id !== card.id));
    }
    if (leading) {
      const first = hand.find((c) => c.id === selected[0]);
      return setSelected(first && first.suit === card.suit && selected.length < 3 ? [...selected, card.id] : [card.id]);
    }
    setSelected([...selected, card.id].slice(-(need ?? 1)));
  };

  return (
    <footer className="relative z-20 flex flex-col items-center gap-3 px-3 pb-4 pt-2">
      <div className="flex h-11 items-center gap-3">
        {active ? (
          <>
            <button className={`${BTN_PRIMARY} !px-6 !py-2`} disabled={!ready} onClick={() => onPlay(selected)}>
              {need && need > 1 ? `ითამაშე ${selected.length}/${need}` : "ითამაშე"}
            </button>
            {secondsLeft !== null && (
              <span className={`tabular-nums ${secondsLeft <= 10 ? "font-bold text-red-300" : "text-white/50"}`}>{secondsLeft}</span>
            )}
          </>
        ) : (
          <span className="text-white/40">{game.phase === "play" ? "ელოდებით…" : ""}</span>
        )}
      </div>
      <div className="flex min-h-[8rem] items-end justify-center gap-2">
        {hand.map((card) => {
          const on = selected.includes(card.id);
          const usable = active && reachable.has(card.id);
          return (
            <button
              key={card.id}
              onClick={() => tap(card)}
              disabled={!usable}
              className={`transition-[translate,opacity] duration-150 ${on ? "-translate-y-4" : usable ? "hover:-translate-y-2" : ""} ${active && !usable ? "opacity-40" : ""}`}
              aria-label={`${card.rank} ${card.suit}`}
            >
              <CardView
                card={card}
                style={{ ...cw(HAND_CW), boxShadow: on ? "0 0 0 3px rgb(252 211 77), 0 8px 16px rgb(0 0 0 / .45)" : undefined }}
              />
            </button>
          );
        })}
      </div>
    </footer>
  );
}

function RoundResult({
  game,
  names,
  onNext,
  autoNext,
  onQuit,
  endNote,
}: {
  game: BuraState;
  names: string[];
  onNext: () => void;
  autoNext?: boolean;
  onQuit: () => void;
  endNote?: React.ReactNode;
}) {
  const r = game.result;
  const final = game.phase === "gameEnd";
  const mine = r?.winner === 0;
  const teams = game.players === 4;
  const title = final
    ? game.scores[0] >= game.target
      ? "გამარჯვება!"
      : "დამარცხება"
    : r?.winner === null
      ? "ფრე: 60 / 60"
      : mine
        ? "რაუნდი თქვენია"
        : "რაუნდი წააგეთ";
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-white/15 bg-[#0c2a1c]/95 p-7 text-center shadow-2xl">
        <h2 className={`text-4xl font-extrabold ${final ? (game.scores[0] >= game.target ? "text-amber-300" : "text-white/80") : ""}`}>{title}</h2>
        {r?.bura !== null && r !== null && (
          <p className="text-lg font-bold text-amber-200">ბურა! {names[r.bura!] ?? ""} სამი კოზირი ხელში</p>
        )}
        {r && r.bura === null && (
          <p className="text-2xl font-bold tabular-nums">
            {r.piles[0]} <span className="text-white/40">:</span> {r.piles[1]}
          </p>
        )}
        {r && r.winner !== null && (
          <p className="text-white/60">
            {mine ? "+" : ""}
            {r.gain} {mine ? "ქულა" : `ქულა ${teams ? "მეტოქეებს" : names[1]}`}
          </p>
        )}
        <p className="text-xl tabular-nums text-white/80">
          {game.scores[0]} <span className="text-white/40">:</span> {game.scores[1]}
        </p>
        {final && endNote && <div className="text-sm">{endNote}</div>}
        <div className="flex gap-3 pt-1">
          {final ? (
            <button className={BTN_PRIMARY} onClick={onQuit}>
              დასრულება
            </button>
          ) : (
            <>
              {autoNext ? (
                <span className="animate-pulse text-white/60">შემდეგი რაუნდი იწყება…</span>
              ) : (
                <button className={BTN_PRIMARY} onClick={onNext}>
                  შემდეგი რაუნდი
                </button>
              )}
              {!autoNext && (
                <button className={BTN_GHOST} onClick={onQuit}>
                  გასვლა
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
