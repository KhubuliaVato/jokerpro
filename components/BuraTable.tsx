"use client";

import { useEffect, useRef, useState } from "react";
import { isRed, SUIT_SYMBOL, sortHand, type NormalCard } from "@/lib/joker/cards";
import { callName, canCall, handSize, isLegal, legalPlays, MAX_PRICE, molotka, needOf, nextLevel, teamOf, type BuraAction, type BuraState } from "@/lib/bura/engine";
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
  /** Calls, answers to calls and "var". */
  onAct: (action: BuraAction) => void;
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
  bottom: "left-1/2 top-[67%] -translate-x-1/2 -translate-y-1/2",
  top: "left-1/2 top-[33%] -translate-x-1/2 -translate-y-1/2",
  left: "left-[27%] top-[56%] -translate-x-1/2 -translate-y-1/2",
  right: "left-[73%] top-[56%] -translate-x-1/2 -translate-y-1/2",
};

export function BuraTable({ game, secondsLeft, names, avatars, onPlay, onAct, onNext, autoNext, onQuit, endNote, quitConfirm }: Props) {
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

  const turnSpot = game.phase === "play" || game.phase === "call" || game.phase === "var" ? spot(game, game.turn) : null;
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
          <span
            className={`rounded-full px-3 py-1.5 text-sm font-bold ${game.price > 1 ? "bg-red-500/25 text-red-200" : "bg-black/30 text-white/70"}`}
            title="რამდენ ქულად ფასობს რაუნდი"
          >
            რაუნდი: {game.price} ქულა
          </span>
          <span className="hidden rounded-full bg-black/30 px-3 py-1.5 text-sm font-bold text-amber-200 sm:inline" title="თქვენი გუნდის აღებული ხელები">
            ხელები: {game.tricks[0]}
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
        <div className="absolute left-3 top-1 z-10 flex items-center gap-3 rounded-2xl bg-black/20 p-2 sm:left-6">
          <div className="relative" style={{ ...cw(TRICK_CW), width: "calc(var(--cw) * 2.3)", height: "calc(var(--cw) * 1.45)" }}>
            {game.deck.length > 0 && (
              <>
                {/* the trump card lies face up, sideways, tucked under the pile */}
                <div className="absolute left-0 top-0 flex items-center justify-center" style={{ width: "calc(var(--cw) * 1.45)", height: "calc(var(--cw) * 1.45)" }}>
                  <div className="-rotate-90">
                    <CardView card={game.trumpCard} style={cw(TRICK_CW)} />
                  </div>
                </div>
                <div className="absolute right-0 top-0">
                  <CardView style={cw(TRICK_CW)} />
                </div>
              </>
            )}
          </div>
          <div className="leading-tight">
            <b className={`block text-3xl ${isRed(game.trump) ? "text-red-400" : "text-white"}`}>{SUIT_SYMBOL[game.trump]}</b>
            <span className="text-xs text-white/60">{game.deck.length} კარტი</span>
          </div>
        </div>

        {/* the trick */}
        {Array.from(new Set(game.trick.map((p) => p.player))).map((player) => {
          const where = spot(game, player);
          const entries = game.trick.filter((p) => p.player === player);
          const best = game.best >= 0 && game.trick[game.best].player === player;
          return (
            <div
              key={`${game.round}-${game.tricks[0] + game.tricks[1]}-${player}`}
              className={`absolute z-10 flex ${TRICK_AT[where]} ${winnerSpot === where && best ? "scale-105" : ""} transition-transform`}
            >
              {entries.flatMap((p) => p.cards.map((c) => ({ c, hidden: p.hidden }))).map(({ c, hidden }, k) => (
                <div key={c.id} style={{ marginLeft: k === 0 ? 0 : `calc(var(--cw) * -0.45)` }}>
                  {/* a card thrown down face down shows its back to everybody but its owner (who sees it dimmed) */}
                  <CardView
                    card={c.id.startsWith("hidden-") || (hidden && player !== 0) ? undefined : c}
                    style={{
                      ...cw(TRICK_CW),
                      opacity: hidden && player === 0 ? 0.55 : undefined,
                      boxShadow: best ? "0 0 0 3px rgb(252 211 77), 0 6px 14px rgb(0 0 0 / .4)" : undefined,
                    }}
                  />
                </div>
              ))}
            </div>
          );
        })}

        {game.trick.length === 0 && game.phase === "play" && (
          <p
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-5 py-2 text-center font-bold ${
              game.turn === 0 ? "bg-amber-300/20 text-amber-200" : "bg-black/25 text-white/60"
            }`}
          >
            {game.turn === 0 ? "თქვენ იწყებთ" : `${names[game.turn]} იწყებს`}
          </p>
        )}

        {(game.phase === "call" || game.phase === "var") && (
          <Decision game={game} names={names} secondsLeft={secondsLeft} onAct={onAct} />
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
        onAct={onAct}
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
        ? "left-3 top-1/2 -translate-y-1/2 flex-col"
        : "right-3 top-1/2 -translate-y-1/2 flex-col";
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
  onAct,
}: {
  game: BuraState;
  active: boolean;
  secondsLeft: number | null;
  onPlay: (ids: string[]) => void;
  onAct: (action: BuraAction) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const hand = sortHand(game.hands[0]) as NormalCard[];
  const leading = game.trick.length === 0;
  const need = leading ? null : needOf(game, 0);
  const mol = active && molotka(game, 0) && molotka(game, 0)!.length !== need ? molotka(game, 0) : null;

  const plays = active ? legalPlays(game, 0) : [];
  const reachable = new Set(
    plays.filter((p) => selected.every((id) => p.some((c) => c.id === id))).flatMap((p) => p.map((c) => c.id)),
  );
  // when only one thing can be played (the whole hand to a molotka) there is nothing to choose
  const forced = plays.length === 1 ? plays[0].map((c) => c.id) : null;
  const ready = active && (forced !== null || (selected.length > 0 && isLegal(game, selected, 0)));

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
      return setSelected(first && first.suit === card.suit && selected.length < handSize(game.players) ? [...selected, card.id] : [card.id]);
    }
    setSelected([...selected, card.id].slice(-(need ?? 1)));
  };

  return (
    <footer className="relative z-20 flex flex-col items-center gap-3 px-3 pb-4 pt-2">
      <div className="flex h-11 items-center gap-3">
        {active ? (
          <>
            <button className={`${BTN_PRIMARY} !px-6 !py-2`} disabled={!ready} onClick={() => onPlay(forced ?? selected)}>
              {need && need > 1 && !forced ? `ითამაშე ${selected.length}/${need}` : "ითამაშე"}
            </button>
            {canCall(game, 0) && (
              <button
                className="rounded-full border border-red-300/60 bg-red-500/20 px-5 py-2 font-bold text-red-100 transition-colors hover:bg-red-500/40"
                onClick={() => onAct({ type: "call" })}
                title={`რაუნდი გახდება ${nextLevel(game)} ქულის`}
              >
                {callName(nextLevel(game))}
              </button>
            )}
            {mol && (
              <button className={`${BTN_GHOST} !px-5 !py-2`} onClick={() => onPlay(mol.map((c) => c.id))} title="მთელი ხელი ერთად">
                მოლოტკა
              </button>
            )}
            {secondsLeft !== null && (
              <span className={`tabular-nums ${secondsLeft <= 10 ? "font-bold text-red-300" : "text-white/50"}`}>{secondsLeft}</span>
            )}
          </>
        ) : (
          <span className="text-white/40">{game.phase === "play" || game.phase === "call" || game.phase === "var" ? "ელოდებით…" : ""}</span>
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

/** A call waiting for an answer, or the winner of a trick deciding on "var". */
function Decision({
  game,
  names,
  secondsLeft,
  onAct,
}: {
  game: BuraState;
  names: string[];
  secondsLeft: number | null;
  onAct: (action: BuraAction) => void;
}) {
  const mine = game.turn === 0;
  const timer =
    mine && secondsLeft !== null ? (
      <span className={`tabular-nums ${secondsLeft <= 10 ? "font-bold text-red-300" : "text-white/50"}`}>{secondsLeft}</span>
    ) : null;

  if (game.phase === "var") {
    return (
      <div className="absolute left-1/2 top-[58%] z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-3xl border border-amber-300/30 bg-[#0c2a1c]/95 px-7 py-5 text-center shadow-2xl">
        {mine ? (
          <>
            <p className="text-lg font-bold">ხელი თქვენია. ვარ?</p>
            <p className="max-w-64 text-sm text-white/60">თუ გუნდს 31 ქულა აქვს, რაუნდს იგებთ. თუ არა — აგებთ.</p>
            <div className="flex items-center gap-3">
              <button className={`${BTN_PRIMARY} !px-7 !py-2`} onClick={() => onAct({ type: "var", say: true })}>
                ვარ!
              </button>
              <button className={`${BTN_GHOST} !px-6 !py-2`} onClick={() => onAct({ type: "var", say: false })}>
                ვაგრძელებ
              </button>
              {timer}
            </div>
          </>
        ) : (
          <p className="text-white/70">{names[game.turn]} ფიქრობს: ვარ თუ გააგრძელოს?</p>
        )}
      </div>
    );
  }

  const call = game.call!;
  const caller = call.by === 0 ? "თქვენ" : (names[call.by] ?? "…");
  return (
    <div className="absolute left-1/2 top-[58%] z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-3xl border border-red-300/40 bg-[#2a1010]/95 px-7 py-5 text-center shadow-2xl">
      <p className="text-2xl font-extrabold text-red-200">{callName(call.level)}!</p>
      <p className="text-white/70">
        {caller} {call.by === 0 ? "ამბობთ" : "ამბობს"}: რაუნდი ღირს {call.level} ქულა
      </p>
      {mine ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button className={`${BTN_PRIMARY} !px-6 !py-2`} onClick={() => onAct({ type: "answer", answer: "accept" })}>
            მივიღებ
          </button>
          {call.level < MAX_PRICE && (
            <button
              className="rounded-full border border-red-300/60 bg-red-500/20 px-5 py-2 font-bold text-red-100 hover:bg-red-500/40"
              onClick={() => onAct({ type: "answer", answer: "raise" })}
            >
              {callName(call.level + 1)}
            </button>
          )}
          <button className={`${BTN_GHOST} !px-5 !py-2`} onClick={() => onAct({ type: "answer", answer: "fold" })} title={`მოწინააღმდეგე ${game.price} ქულას აიღებს`}>
            ვთმობ
          </button>
          {timer}
        </div>
      ) : (
        <p className="text-sm text-white/50">{names[game.turn]} ფიქრობს…</p>
      )}
    </div>
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
    <div className={`absolute inset-0 z-30 grid place-items-center p-4 ${final ? "bg-black/55 backdrop-blur-sm" : "bg-black/35"}`}>
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-white/15 bg-[#0c2a1c]/95 p-7 text-center shadow-2xl">
        <h2 className={`text-4xl font-extrabold ${final ? (game.scores[0] >= game.target ? "text-amber-300" : "text-white/80") : ""}`}>{title}</h2>
        {r?.bura !== null && r !== null && (
          <p className="text-lg font-bold text-amber-200">ბურა! {names[r.bura!] ?? ""} ხელში მხოლოდ კოზირებია</p>
        )}
        {r && r.how === "var" && r.by !== null && (
          <p className="text-lg font-bold text-amber-200">
            {r.by === 0 ? "თქვენ თქვით" : `${names[r.by] ?? ""} თქვა`}: ვარ! {(r.winner === 0) === (r.by === 0) ? "31 ქულა ჰქონდა" : "31 ქულა არ ჰქონდა"}
          </p>
        )}
        {r && r.how === "fold" && r.by !== null && (
          <p className="text-lg font-bold text-red-200">
            {r.by === 0 ? "თქვენს გამოძახებას დათმეს" : `${names[r.by] ?? ""}-ის გამოძახებას დათმეს`}
          </p>
        )}
        {r && r.bura === null && r.how !== "fold" && (
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
                <span className="flex w-56 flex-col items-center gap-2 text-sm text-white/60">
                  შემდეგი რაუნდი იწყება…
                  <span className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full origin-left animate-[bura-fill_5s_linear_forwards] rounded-full bg-amber-300" />
                  </span>
                </span>
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
