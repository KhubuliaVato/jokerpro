"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  isRed,
  SUIT_NAME,
  SUIT_SYMBOL,
  SUITS,
  sortHand,
  type Card,
  type Suit,
} from "@/lib/joker/cards";
import {
  legalBids,
  legalPlays,
  locateHand,
  PLAYERS,
  totals,
  type GameState,
  type PlayOption,
} from "@/lib/joker/engine";
import { schedule } from "@/lib/joker/rules";
import { HUMAN, TURN_SECONDS } from "@/lib/joker/useGame";
import { DEFAULT_VOLUME, playCardSound, playDealSound, setMasterVolume } from "@/lib/sound";
import { Avatar } from "./Avatar";
import { CardView } from "./CardView";
import { usePlayerAvatars, usePlayerNames } from "./names";
import { ScoreSheet } from "./ScoreSheet";

interface Props {
  game: GameState;
  secondsLeft: number | null;
  onBid: (n: number) => void;
  onTrump: (suit: Suit | null) => void;
  onPlay: (option: PlayOption) => void;
  onQuit: () => void;
  /** Shown under the final standings (e.g. whether the result was saved). */
  endNote?: React.ReactNode;
  /** Replaces the "are you sure" text of the leave button. */
  quitConfirm?: string;
}

// Hand fan: degrees between neighbouring cards, and the pivot's depth below a card (% of its height).
const FAN_STEP = 2;
const FAN_PIVOT = 700;

const suitColor = (suit: Suit) => (isRed(suit) ? "text-red-400" : "text-white");

const AVATAR = [
  "from-amber-300 to-orange-500",
  "from-sky-300 to-blue-500",
  "from-rose-300 to-pink-500",
  "from-violet-300 to-purple-500",
];

function PlayerTag({
  game,
  seat,
  compact,
}: {
  game: GameState;
  seat: number;
  compact?: boolean;
}) {
  const avatars = usePlayerAvatars();
  const names = usePlayerNames();
  const bid = game.bids[seat];
  const active =
    game.turn === seat && (game.phase === "bidding" || game.phase === "playing" || game.phase === "trump");
  // The player left of the dealer opens the hand: first to bid and first to lead.
  const starts =
    seat === (game.dealer + 1) % PLAYERS &&
    game.phase !== "trickEnd" &&
    game.hands[HUMAN].length === game.cards &&
    game.trick.length === 0;

  const photo = avatars?.[seat];
  const avatar = photo ? (
    <Avatar size="sm" color={photo.color} icon={photo.icon} url={photo.url} />
  ) : (
    <span
      className={`grid size-8 flex-none place-items-center rounded-full bg-gradient-to-br text-sm font-extrabold text-black/80 shadow-inner ring-2 ${AVATAR[seat]} ${active ? "ring-amber-300" : "ring-white/30"}`}
    >
      {names[seat][0]}
    </span>
  );
  const score =
    bid === null ? null : (
      <span className={`flex items-center gap-2 text-xs tabular-nums ${compact ? "justify-center" : ""}`}>
        <span title="ნათქვამი">
          <span className="opacity-60">ნათ.</span> <b className="text-sm">{bid === 0 ? "—" : bid}</b>
        </span>
        <span title="წაღებული">
          <span className="opacity-60">წაღ.</span>{" "}
          <b className={`text-sm ${game.taken[seat] === bid ? "text-emerald-300" : game.taken[seat] > bid ? "text-red-300" : ""}`}>
            {game.taken[seat]}
          </b>
        </span>
      </span>
    );
  const startBadge = starts && (
    <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[0.65rem] font-extrabold text-black">
      ▶ იწყებს
    </span>
  );

  return (
    <div
      className={`rounded-2xl border bg-black/35 backdrop-blur-sm transition-shadow ${
        active ? "border-amber-300 shadow-[0_0_16px_rgb(232_196_106/0.55)]" : "border-white/15"
      } ${compact ? "flex w-full flex-col items-center gap-1 px-2 py-2" : "flex items-center gap-2.5 px-3 py-1.5"}`}
    >
      {avatar}
      <span className={`flex ${compact ? "flex-col items-center gap-1" : "flex-col gap-0.5"}`}>
        <b className="text-sm leading-none">{names[seat]}</b>
        {score}
      </span>
      {startBadge}
    </div>
  );
}

function TrumpInfo({ game }: { game: GameState }) {
  const { phase, trump, trumpCard } = game;
  return (
    <div className="panel flex items-center gap-3 px-3 py-2 sm:px-4 sm:py-2.5">
      <span className="rotate-180 text-xs font-bold tracking-wide opacity-70 [writing-mode:vertical-rl]">
        კოზირი
      </span>
      {phase === "trump" ? (
        <span className="text-sm opacity-80">ირჩევა…</span>
      ) : (
        <>
          {trumpCard && <CardView card={trumpCard} size="sm" />}
          {trump ? (
            <span className={`flex flex-col items-center leading-none ${suitColor(trump)}`}>
              <span className="text-4xl sm:text-5xl">{SUIT_SYMBOL[trump]}</span>
              <span className="mt-1 text-xs font-bold sm:text-sm">{SUIT_NAME[trump]}</span>
            </span>
          ) : (
            <span className="text-lg font-extrabold sm:text-xl">უკოზიროდ</span>
          )}
        </>
      )}
    </div>
  );
}

// Where each seat's played card lands, in card widths from the table centre, plus its resting tilt.
const TRICK_SLOT = [
  { x: 0.04, y: 0.5, rot: -4 }, // you
  { x: -0.98, y: -0.28, rot: 7 }, // left
  { x: -0.04, y: -1.1, rot: 3 }, // across
  { x: 0.98, y: -0.3, rot: -8 }, // right
];
// Where the card flies in from (card widths, relative to its slot).
const TRICK_FROM = [
  { x: 0, y: 4.5 },
  { x: -5, y: 0 },
  { x: 0, y: -4 },
  { x: 5, y: 0 },
];

// Where the winner collects the trick (card widths from the table centre).
const TRICK_TAKE = [
  { x: 0, y: 4.4 },
  { x: -5.2, y: 0 },
  { x: 0, y: -4.4 },
  { x: 5.2, y: 0 },
];

/** Tag under a played joker: what was chosen, so everyone at the table can see it. */
function JokerBadge({
  mode,
  suit,
  small,
}: {
  mode?: "high" | "low";
  suit?: Suit | null;
  small?: boolean;
}) {
  // With a named suit the joker was led ("მაღალი" / "წაიღოს"); otherwise it was played on someone's lead.
  const label = suit ? (mode === "high" ? "მაღალი" : "წაიღოს") : mode === "high" ? "მოჯოკვრა" : "გატანება";
  return (
    <span
      className={`absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-black/85 font-extrabold text-amber-200 ring-1 ring-amber-300/60 ${
        small ? "-bottom-2 px-1.5 py-0.5 text-[0.55rem]" : "-bottom-3 px-2.5 py-1 text-xs"
      }`}
    >
      {label}
      {suit && (
        <span className={`${small ? "text-xs" : "text-base"} leading-none ${isRed(suit) ? "text-red-400" : "text-white"}`}>
          {SUIT_SYMBOL[suit]}
        </span>
      )}
    </span>
  );
}

/** A small deterministic wobble per card, so a trick never looks mechanically aligned. */
function wobble(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 7) - 3) * 0.8;
}

function TrickArea({ game }: { game: GameState }) {
  return (
    <div
      className="relative h-[min(17rem,36dvh)] w-full max-w-[26rem]"
      style={{ "--tcw": "clamp(3.4rem, min(15vw, 11.5dvh), 6.2rem)" } as React.CSSProperties}
    >
      <style>{`@keyframes deal-in{from{opacity:0;transform:translate(var(--fx),var(--fy)) scale(.8)}to{opacity:1;transform:none}}@keyframes take-trick{to{translate:calc(-50% + var(--tcw) * var(--tx)) calc(-50% + var(--tcw) * var(--ty));scale:.55;opacity:0}}`}</style>
      {game.trick.map((p, i) => {
        const slot = TRICK_SLOT[p.player];
        const from = TRICK_FROM[p.player];
        // Once the winner is shown, the trick glides over to them and fades out.
        const take = game.phase === "trickEnd" && game.trickWinner !== null ? TRICK_TAKE[game.trickWinner] : null;
        return (
          <div
            key={p.card.id}
            className="absolute left-1/2 top-1/2"
            style={
              {
                translate: `calc(-50% + var(--tcw) * ${slot.x}) calc(-50% + var(--tcw) * ${slot.y})`,
                rotate: `${slot.rot + wobble(p.card.id)}deg`,
                ...(take && {
                  "--tx": take.x,
                  "--ty": take.y,
                  animation: `take-trick 0.55s cubic-bezier(0.5, 0, 0.8, 0.4) ${0.85 + i * 0.04}s both`,
                }),
              } as React.CSSProperties
            }
          >
            <div
              className="relative"
              style={
                {
                  "--fx": `calc(var(--tcw) * ${from.x})`,
                  "--fy": `calc(var(--tcw) * ${from.y})`,
                  animation: "deal-in 0.34s cubic-bezier(0.2, 0.9, 0.3, 1) both",
                } as React.CSSProperties
              }
            >
              <CardView
                // A joker given away ("გატანება") lies face down.
                card={p.card.joker && p.mode === "low" ? undefined : p.card}
                size="sm"
                style={{ "--cw": "var(--tcw)" } as React.CSSProperties}
                className={`shadow-[0_4px_10px_rgb(0_0_0/0.4)] ${game.trickWinner === p.player ? "win-glow" : ""}`}
              />
              {p.card.joker && <JokerBadge mode={p.mode} suit={p.suit} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OpponentHand({ count, seat }: { count: number; seat: number }) {
  const cw = "var(--opp-cw)";
  const step = 0.3;
  const badge = (
    <span className="absolute -bottom-2 -right-2 z-10 grid size-6 place-items-center rounded-full bg-black/80 text-xs font-bold ring-1 ring-white/20">
      {count}
    </span>
  );
  if (seat === 2) {
    const mid = (count - 1) / 2;
    return (
      <div
        className="relative flex items-end justify-center"
        style={{ minHeight: `calc(${cw} * 1.55)` }}
      >
        {Array.from({ length: count }, (_, i) => (
          <CardView
            key={i}
            size="opp"
            style={{
              marginLeft: i === 0 ? 0 : `calc(${cw} * -0.66)`,
              transform: `translateY(${Math.pow(i - mid, 2) * 1.4}px) rotate(${(i - mid) * 4.5}deg)`,
              transformOrigin: "50% 130%",
            }}
          />
        ))}
        {count > 0 && badge}
      </div>
    );
  }
  const turn = seat === 1 ? 90 : -90;
  return (
    <div
      className="relative"
      style={{
        width: `calc(${cw} * 1.4)`,
        height: `calc(${cw} + ${Math.max(count - 1, 0)} * ${cw} * ${step})`,
        minHeight: `calc(${cw} * 1.4)`,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <CardView
          key={i}
          size="opp"
          className="!absolute"
          style={{
            left: `calc(${cw} * 0.2)`,
            top: `calc(${i} * ${cw} * ${step} - ${cw} * 0.2)`,
            transform: `rotate(${turn}deg)`,
          }}
        />
      ))}
      {count > 0 && badge}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-3">
      <div className="panel w-full max-w-3xl p-4 sm:p-5">{children}</div>
    </div>
  );
}

export function Table({ game, secondsLeft, onBid, onTrump, onPlay, onQuit, endNote, quitConfirm }: Props) {
  const names = usePlayerNames();
  // The pending joker choice only counts for the position it was made in.
  const moveKey = `${game.handIndex}:${game.played.length}`;
  const [pick, setPick] = useState<{ card: Card; key: string } | null>(null);
  const jokerPick = pick && pick.key === moveKey ? pick.card : null;
  const setJokerPick = (card: Card | null) => setPick(card && { card, key: moveKey });

  // The joker menu closes on any click outside it (and on Escape).
  const jokerOpen = jokerPick !== null;
  useEffect(() => {
    if (!jokerOpen) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as Element).closest("[data-joker]")) {
        setPick(null);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [jokerOpen]);
  const [lastOpen, setLastOpen] = useState(false);

  // Sounds: the shuffle/deal when a new hand starts, a card slap for every card played.
  // Every game starts quiet (20%); the player can raise it from the header.
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  setMasterVolume(volume);
  const dealtHand = useRef(-1);
  useEffect(() => {
    if (dealtHand.current === game.handIndex) return;
    dealtHand.current = game.handIndex;
    playDealSound();
  }, [game.handIndex]);
  const playedCount = useRef(game.trick.length);
  useEffect(() => {
    if (game.trick.length > playedCount.current) playCardSound();
    playedCount.current = game.trick.length;
  }, [game.trick.length]);

  const sums = totals(game);
  const loc = locateHand(game.rules, game.handIndex);
  const pulkas = schedule(game.rules.format);
  const myTurn = game.turn === HUMAN;
  const canPlay = game.phase === "playing" && myTurn;
  const options = canPlay ? legalPlays(game, HUMAN) : [];
  const playable = new Set(options.map((o) => o.card.id));
  const myHand = sortHand(game.hands[HUMAN]);
  // While the others act, the hand is softly dimmed.
  const waiting = !(myTurn && (game.phase === "bidding" || game.phase === "trump" || game.phase === "playing"));

  const clickCard = (card: Card) => {
    if (!canPlay || !playable.has(card.id)) return;
    if (card.joker) {
      setJokerPick(card);
      return;
    }
    setJokerPick(null);
    onPlay({ card });
  };
  const playJoker = (opt: PlayOption) => {
    setJokerPick(null);
    onPlay(opt);
  };

  let status = "";
  if (game.phase === "trump") {
    status = myTurn ? "" : `${names[game.turn]} ირჩევს კოზირს…`;
  } else if (game.phase === "bidding") {
    status = myTurn ? "" : `${names[game.turn]} ფიქრობს…`;
  } else if (game.phase === "playing") {
    status = myTurn ? "თქვენი სვლა" : `${names[game.turn]} ფიქრობს…`;
  } else if (game.phase === "trickEnd" && game.trickWinner !== null) {
    status =
      game.trickWinner === HUMAN
        ? "ხელი თქვენია"
        : `ხელს იღებს ${names[game.trickWinner]}`;
  }

  const bidChoices = game.phase === "bidding" && myTurn ? legalBids(game, HUMAN) : [];
  const jokerOptions = jokerPick
    ? options.filter((o) => o.card.id === jokerPick.id)
    : [];
  const leading = game.trick.length === 0;

  return (
    <main className="felt relative flex h-dvh cursor-default select-none flex-col overflow-hidden">
      <header className="flex items-start justify-between gap-2 px-3 py-2 text-xs sm:text-sm">
        <div className="flex flex-col gap-1.5">
          <Scoreboard sums={sums} game={game} />
          <div className="panel px-2 pb-2 pt-1.5">
            <div className="grid grid-cols-3 divide-x divide-white/10 text-center">
              {[
                ["ეტაპი", `${loc.pulka + 1}/${pulkas.length}`],
                ["ხელი", `${loc.inPulka + 1}/${loc.pulkaLength}`],
                ["კარტი", String(loc.cards)],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col leading-tight">
                  <span className="text-[0.65rem] font-semibold text-white/50">{label}</span>
                  <b className="text-sm tabular-nums sm:text-base">{value}</b>
                </div>
              ))}
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-amber-300 transition-[width] duration-500"
                style={{ width: `${(game.handIndex / pulkas.flat().length) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <VolumeControl volume={volume} onChange={setVolume} />
            <button
              className="btn !px-3 !py-1"
              onClick={() => window.confirm(quitConfirm ?? "დარწმუნებული ხართ? თამაში შეწყდება.") && onQuit()}
            >
              გასვლა
            </button>
          </div>
          <TrumpInfo game={game} />
        </div>
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_1fr] items-center gap-x-2 px-2">
        <div className="col-span-3 flex flex-col items-center gap-1">
          <PlayerTag game={game} seat={2} />
          <OpponentHand count={game.hands[2].length} seat={2} />
        </div>
        <div className="flex w-[5rem] flex-col items-center gap-2 sm:w-28">
          <PlayerTag game={game} seat={1} compact />
          <OpponentHand count={game.hands[1].length} seat={1} />
        </div>
        <div className="relative grid self-stretch place-items-center">
          <TrickArea game={game} />
          {myTurn && game.phase === "trump" && (
            <TrumpPicker secondsLeft={secondsLeft} onPick={onTrump} />
          )}
          {jokerPick && canPlay && (
            <JokerMenu leading={leading} options={jokerOptions} onPick={playJoker} />
          )}
          {myTurn && game.phase === "bidding" && (
            <BidPicker
              secondsLeft={secondsLeft}
              cards={game.cards}
              allowed={bidChoices}
              onPick={onBid}
            />
          )}
        </div>
        <div className="flex w-[5rem] flex-col items-center gap-2 sm:w-28">
          <PlayerTag game={game} seat={3} compact />
          <OpponentHand count={game.hands[3].length} seat={3} />
        </div>
      </section>

      <footer className="relative flex flex-col items-center gap-2 px-2 pb-3">
        <div className="flex min-h-9 items-center gap-3 text-sm font-bold text-amber-200">
          {status}
          {myTurn && game.phase === "playing" && secondsLeft !== null && <TurnTimer left={secondsLeft} />}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 sm:hidden">
          <PlayerTag game={game} seat={HUMAN} />
          {game.lastTrick && (
            <LastTrickDock trick={game.lastTrick} open={lastOpen} onToggle={setLastOpen} />
          )}
        </div>
        <div className="absolute bottom-3 left-3 hidden flex-col items-start gap-2 sm:flex">
          {game.lastTrick && (
            <LastTrickDock trick={game.lastTrick} open={lastOpen} onToggle={setLastOpen} />
          )}
          <PlayerTag game={game} seat={HUMAN} />
        </div>
        <div className="flex max-w-full justify-center px-2 pb-10 pt-3">
          <div className="relative flex items-end">
            {myHand.map((card, i) => {
              const ok = canPlay && playable.has(card.id);
              // A true fan: every card sits on the same spot and is turned about a pivot far below the
              // hand, so the spacing comes from the angle and the row forms a tight, even arc.
              const rot = (i - (myHand.length - 1) / 2) * FAN_STEP;
              return (
                <button
                  key={card.id}
                  type="button"
                  className={`hand-card ${ok ? "playable" : ""} ${canPlay && !ok ? "dim" : ""} ${waiting ? "brightness-[0.78] saturate-[0.8]" : ""}`}
                  style={
                    {
                      "--rot": `${rot}deg`,
                      rotate: `${rot}deg`,
                      transformOrigin: `50% ${FAN_PIVOT}%`,
                      marginLeft: i === 0 ? 0 : "calc(var(--hand-cw) * -1)",
                    } as React.CSSProperties
                  }
                  data-joker={card.joker ? "" : undefined}
                  onClick={() => clickCard(card)}
                  disabled={!ok}
                  aria-label={card.joker ? "ჯოკერი" : card.id}
                >
                  <CardView card={card} />
                </button>
              );
            })}
          </div>
        </div>
      </footer>

      {game.phase === "gameEnd" && (
        <Overlay>
          <h2 className="mb-2 text-center text-xl font-extrabold text-amber-200">
            თამაში დასრულდა
          </h2>
          <Standings sums={sums} />
          {endNote && <div className="mb-3 text-center text-sm">{endNote}</div>}
          <ScoreSheet game={game} />
          <button className="btn btn-primary mt-3 w-full" onClick={onQuit}>
            ახალი თამაში
          </button>
          <Link href="/" className="btn mt-2 block w-full text-center">
            მთავარი მენიუ
          </Link>
        </Overlay>
      )}
    </main>
  );
}

function Standings({ sums }: { sums: number[] }) {
  const names = usePlayerNames();
  const order = Array.from({ length: PLAYERS }, (_, p) => p).sort((a, b) => sums[b] - sums[a]);
  return (
    <ol className="mb-3 flex flex-col gap-1 text-center">
      {order.map((p, i) => (
        <li key={p} className={i === 0 ? "text-lg font-bold text-amber-300" : ""}>
          {i + 1}. {names[p]} — {sums[p]}
          {i === 0 && p === HUMAN && " 🎉"}
        </li>
      ))}
    </ol>
  );
}

const GOOD = "text-emerald-300";
const BAD = "text-red-300";
const COLS = "grid grid-cols-[1.4rem_repeat(4,minmax(0,1fr))] items-center";

type Entry =
  | { kind: "hand"; h: GameState["history"][number]; n: number }
  | { kind: "premium"; pulka: number };

/**
 * Top-left standings: names and totals. Hovering (or tapping) unfolds the whole game
 * downwards, newest hand first, without changing the width.
 */
function Scoreboard({ sums, game }: { sums: number[]; game: GameState }) {
  const names = usePlayerNames();
  const [pinned, setPinned] = useState(false);
  const top = Math.max(...sums);
  const started = game.history.length > 0;

  const entries: Entry[] = [];
  game.history.forEach((h, i) => {
    entries.push({ kind: "hand", h, n: i + 1 });
    const { inPulka, pulkaLength } = locateHand(game.rules, i);
    if (inPulka === pulkaLength - 1 && game.premiums[h.pulka].some((v) => v > 0)) {
      entries.push({ kind: "premium", pulka: h.pulka });
    }
  });
  entries.reverse();

  return (
    <div className="group relative w-[min(21rem,64vw)]">
      <button
        type="button"
        onClick={() => setPinned((v) => !v)}
        className="panel block w-full px-3 py-2.5 text-left"
        aria-label="ქულების სია"
        aria-expanded={pinned}
      >
        <div className={`${COLS} mb-1 text-center text-xs font-bold sm:text-sm`}>
          <span />
          {names.map((name, p) => (
            <span key={name} className={`truncate ${sums[p] === top && started ? "text-amber-300" : ""}`}>
              {name}
            </span>
          ))}
        </div>
        <div className={`${COLS} text-center text-lg font-extrabold tabular-nums sm:text-2xl`}>
          <span />
          {sums.map((v, p) => (
            <span key={p} className={v === top && started ? "text-amber-300" : ""}>
              {v}
            </span>
          ))}
        </div>
        <div className="mt-0.5 text-center text-[0.6rem] leading-none opacity-40 transition-opacity group-hover:opacity-0">
          ▾
        </div>
      </button>

      <div className="absolute inset-x-0 top-full z-30 pt-1">
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
            pinned
              ? "grid-rows-[1fr] opacity-100"
              : "pointer-events-none grid-rows-[0fr] opacity-0 group-hover:pointer-events-auto group-hover:grid-rows-[1fr] group-hover:opacity-100"
          }`}
        >
          <div className="min-h-0 overflow-hidden rounded-2xl">
            <div className="panel max-h-[55dvh] overflow-y-auto rounded-2xl px-3 py-2">
              {entries.length === 0 ? (
                <p className="py-2 text-center text-xs opacity-60">
                  ქულები პირველი ხელის შემდეგ გამოჩნდება
                </p>
              ) : (
                <>
                  <div className={`${COLS} pb-1 text-center text-[0.65rem] opacity-60`}>
                    <span />
                    {names.map((name) => (
                      <span key={name} className="grid grid-cols-2 border-l border-white/30">
                        <span>ნათ.</span>
                        <span>წაღ.</span>
                      </span>
                    ))}
                  </div>
                  {entries.map((e) =>
                    e.kind === "premium" ? (
                      <div
                        key={`pr${e.pulka}`}
                        className={`${COLS} border-t border-amber-300/30 py-1.5 text-center text-xs font-bold text-amber-300`}
                      >
                        <span>★</span>
                        {game.premiums[e.pulka].map((v, p) => (
                          <span key={p} className="border-l border-white/30">
                            {v > 0 ? `+${v}` : ""}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div key={e.n} className={`${COLS} border-t border-white/10 py-1.5 text-center`}>
                        <span className="text-[0.65rem] opacity-40">{e.h.cards}</span>
                        {e.h.bids.map((bid, p) => {
                          const taken = e.h.taken[p];
                          return (
                            <span
                              key={p}
                              title={`${e.h.points[p] > 0 ? "+" : ""}${e.h.points[p]}`}
                              className="grid grid-cols-2 border-l border-white/30 text-base font-bold tabular-nums"
                            >
                              <span>{bid === 0 ? "—" : bid}</span>
                              <span className={bid === taken ? GOOD : BAD}>
                                {bid > 0 && taken === 0 ? (
                                  <span title="ხიშტი" className="whitespace-nowrap text-sm tracking-tighter">
                                    [--]
                                  </span>
                                ) : (
                                  taken
                                )}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    ),
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TurnTimer({ left }: { left: number }) {
  const urgent = left <= 10;
  const r = 15;
  const circ = 2 * Math.PI * r;
  return (
    <span
      className={`relative grid size-10 place-items-center ${urgent ? "animate-pulse text-red-300" : "text-amber-200"}`}
      aria-label={`დარჩა ${left} წამი`}
    >
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="rgb(0 0 0 / 0.35)" stroke="rgb(255 255 255 / 0.15)" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={urgent ? "#f87171" : "#e8c46a"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - left / TURN_SECONDS)}
          className="transition-[stroke-dashoffset] duration-300 ease-linear"
        />
      </svg>
      <span className="relative text-sm font-extrabold tabular-nums">{left}</span>
    </span>
  );
}

/** Speaker icon (click to mute / restore) with a volume slider. */
function VolumeControl({ volume, onChange }: { volume: number; onChange: (v: number) => void }) {
  const lastAudible = useRef(DEFAULT_VOLUME);
  useEffect(() => {
    if (volume > 0) lastAudible.current = volume;
  }, [volume]);
  const icon = volume === 0 ? "🔇" : volume < 0.4 ? "🔈" : volume < 0.75 ? "🔉" : "🔊";
  return (
    <div className="chip flex items-center gap-2 !rounded-full px-3 py-1" title="ხმა">
      <button
        type="button"
        className="text-base leading-none"
        aria-label={volume === 0 ? "ხმის ჩართვა" : "ხმის გამორთვა"}
        onClick={() => onChange(volume === 0 ? lastAudible.current : 0)}
      >
        {icon}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        aria-label="ხმის სიმაღლე"
        className="h-1 w-16 cursor-pointer accent-amber-300 sm:w-24"
      />
      <span className="w-8 text-right text-[0.7rem] tabular-nums opacity-70">{Math.round(volume * 100)}%</span>
    </div>
  );
}

/** Shared frame of the bid / trump pickers: a soft spotlight on the felt and an ornamental title. */
function PickerStage({
  title,
  secondsLeft,
  low,
  children,
}: {
  title: string;
  secondsLeft: number | null;
  /** Sit at the bottom of the table instead of the middle (keeps played cards visible). */
  low?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-10 flex justify-center ${low ? "items-end pb-2" : "items-center"}`}
    >
      <div className="relative flex flex-col items-center gap-6">
        <div className="absolute -inset-x-16 -inset-y-12 -z-10 rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_0_0/0.4),transparent)]" />
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-amber-300/80 sm:w-16" />
          <span className="text-lg font-extrabold text-amber-200 sm:text-xl">{title}</span>
          {secondsLeft !== null && <TurnTimer left={secondsLeft} />}
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-amber-300/80 sm:w-16" />
        </div>
        {children}
      </div>
    </div>
  );
}

/** Bid choice: round chips floating over the table; forbidden numbers are struck out. */
function BidPicker({
  secondsLeft,
  cards,
  allowed,
  onPick,
}: {
  secondsLeft: number | null;
  cards: number;
  allowed: number[];
  onPick: (bid: number) => void;
}) {
  return (
    <PickerStage title="რამდენს იტყვით?" secondsLeft={secondsLeft}>
      <div
        className="pointer-events-auto flex max-w-xl flex-wrap justify-center gap-2.5 sm:gap-3"
        style={{ "--from": "2rem" } as React.CSSProperties}
      >
        {Array.from({ length: cards + 1 }, (_, n) => {
          const ok = allowed.includes(n);
          return (
            <button
              key={n}
              disabled={!ok}
              onClick={() => onPick(n)}
              style={{ animationDelay: `${n * 35}ms` }}
              className="group relative block h-[4.5rem] w-14 drop-in disabled:cursor-not-allowed sm:h-24 sm:w-[4.5rem]"
              aria-label={n === 0 ? "პასი" : String(n)}
            >
              <span
                className={`grid size-full place-items-center rounded-xl font-extrabold leading-none transition-[translate,box-shadow] duration-200 ease-out ${
                  ok
                    ? "bg-[#fbf8ef] text-neutral-900 shadow-[0_6px_16px_rgb(0_0_0/0.45)] ring-1 ring-black/10 group-hover:-translate-y-3 group-hover:shadow-[0_0_0_3px_#e8c46a,0_16px_24px_rgb(0_0_0/0.45)] group-active:translate-y-0"
                    : "bg-black/20 text-white/25 ring-1 ring-white/10 line-through"
                } ${n === 0 ? "text-sm sm:text-base" : "text-3xl sm:text-4xl"}`}
              >
                {n === 0 ? "პასი" : n}
              </span>
            </button>
          );
        })}
      </div>
      {allowed.length < cards + 1 && (
        <p className="-mt-2 max-w-sm text-center text-xs text-white/60">
          გადახაზული რიცხვი ბოლო დამკვეთს ეკრძალება: ჯამი არ უნდა გაუტოლდეს ხელების რაოდენობას
        </p>
      )}
    </PickerStage>
  );
}

/** Trump choice: five big cards dealt onto the table, no words (the joker card means "no trump"). */
const TRUMP_TILE = "group relative block h-32 w-20 drop-in sm:h-40 sm:w-[6.5rem]";

function TrumpPicker({
  secondsLeft,
  onPick,
}: {
  secondsLeft: number | null;
  onPick: (suit: Suit | null) => void;
}) {
  const tiles = [...SUITS, null] as const;
  return (
    <PickerStage title="აირჩიეთ კოზირი" secondsLeft={secondsLeft}>
      <div className="pointer-events-auto flex items-start gap-2.5 sm:gap-4" style={{ "--from": "3rem" } as React.CSSProperties}>
        {tiles.map((s, i) => {
          const d = i - 2;
          return (
            <button
              key={s ?? "none"}
              className={TRUMP_TILE}
              // Fan: tilt each card and let the outer ones sit lower, so the row forms a dome.
              style={{ rotate: `${d * 4}deg`, translate: `0 ${d * d * 0.4}rem`, animationDelay: `${i * 70}ms` }}
              aria-label={s ? SUIT_NAME[s] : "უკოზიროდ"}
              onClick={() => onPick(s)}
            >
              {/* The outer button keeps a fixed hit area; only this face moves on hover. */}
              <span
                className={`flex size-full flex-col items-center justify-center gap-2 rounded-xl leading-none shadow-[0_6px_16px_rgb(0_0_0/0.45)] ring-1 ring-black/10 transition-[translate,box-shadow] duration-200 ease-out group-hover:-translate-y-3 group-hover:shadow-[0_0_0_3px_#e8c46a,0_16px_24px_rgb(0_0_0/0.45)] group-active:translate-y-0 ${s ? "bg-[#fbf8ef]" : "bg-gradient-to-br from-[#fff4e0] via-[#f1ddff] to-[#d9e6ff]"}`}
              >
                <span className={`text-5xl sm:text-6xl ${s ? (isRed(s) ? "text-red-600" : "text-neutral-900") : "text-purple-700"}`}>
                  {s ? SUIT_SYMBOL[s] : "★"}
                </span>
                <span className={`text-xs font-extrabold sm:text-sm ${s ? (isRed(s) ? "text-red-700" : "text-neutral-800") : "text-purple-800"}`}>
                  {s ? SUIT_NAME[s] : "უკოზიროდ"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </PickerStage>
  );
}

/** Joker choice, in the middle of the table: take the trick (high) or give it away (low). */
function JokerMenu({
  leading,
  options,
  onPick,
}: {
  leading: boolean;
  options: PlayOption[];
  onPick: (opt: PlayOption) => void;
}) {
  const modes = [
    {
      mode: "high",
      label: leading ? "მაღალი" : "მოჯოკვრა",
    },
    {
      mode: "low",
      label: leading ? "წაიღოს" : "გატანება",
    },
  ] as const;
  return (
    <PickerStage title="ჯოკერი" secondsLeft={null} low>
      <div
        data-joker
        className="pointer-events-auto flex flex-col gap-4"
        style={{ "--from": "2rem" } as React.CSSProperties}
      >
        {leading ? (
          modes.map(({ mode, label }, r) => (
            <div key={mode} className="drop-in flex items-center gap-4 sm:gap-5" style={{ animationDelay: `${r * 80}ms` }}>
              <span className={`w-24 text-base font-extrabold sm:w-28 sm:text-lg ${mode === "high" ? "text-amber-300" : "text-white"}`}>
                {label}
              </span>
              <span className="flex gap-2.5 sm:gap-3">
                {options
                  .filter((o) => o.mode === mode)
                  .map((o) => (
                    <button
                      key={o.suit}
                      onClick={() => onPick(o)}
                      aria-label={`${label} ${SUIT_NAME[o.suit as Suit]}`}
                      title={SUIT_NAME[o.suit as Suit]}
                      className="group relative block size-14 sm:size-16"
                    >
                      <span
                        className={`grid size-full place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fffdf6,#efe8d3)] text-4xl leading-none shadow-[0_3px_8px_rgb(0_0_0/0.45)] transition-[translate,box-shadow] duration-150 ease-out group-hover:-translate-y-1.5 group-hover:shadow-[0_0_0_3px_#e8c46a,0_10px_16px_rgb(0_0_0/0.45)] group-active:translate-y-0 ${
                          mode === "high" ? "ring-[3px] ring-amber-300/90" : "opacity-90 ring-2 ring-white/25"
                        } ${isRed(o.suit as Suit) ? "text-red-600" : "text-neutral-900"}`}
                      >
                        {SUIT_SYMBOL[o.suit as Suit]}
                      </span>
                    </button>
                  ))}
              </span>
            </div>
          ))
        ) : (
          <div className="flex gap-3 sm:gap-5">
            {modes.map(({ mode, label }, i) => {
              const opt = options.find((o) => o.mode === mode);
              if (!opt) return null;
              return (
                <button
                  key={mode}
                  onClick={() => onPick(opt)}
                  className="group relative block h-20 w-36 drop-in sm:h-24 sm:w-44"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <span
                    className={`flex size-full flex-col items-center justify-center gap-1 rounded-2xl shadow-[0_6px_16px_rgb(0_0_0/0.45)] transition-[translate,box-shadow] duration-200 ease-out group-hover:-translate-y-2.5 group-hover:shadow-[0_0_0_3px_#e8c46a,0_16px_24px_rgb(0_0_0/0.45)] group-active:translate-y-0 ${
                      mode === "high"
                        ? "bg-gradient-to-b from-[#f6e3a3] to-[#d9ac3f] text-[#2b2005]"
                        : "bg-[#fbf8ef] text-neutral-900"
                    }`}
                  >
                    <span className="text-xl font-extrabold sm:text-2xl">{label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </PickerStage>
  );
}

/** "Previous trick" chip; the details pop up above it, anchored to its left edge. */
function LastTrickDock({
  trick,
  open,
  onToggle,
}: {
  trick: NonNullable<GameState["lastTrick"]>;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  return (
    <div className="relative">
      {open && <LastTrick trick={trick} onClose={() => onToggle(false)} />}
      <button
        type="button"
        className={`chip flex items-center gap-1.5 whitespace-nowrap px-3 py-1 text-xs font-bold transition-colors hover:border-amber-300/60 ${open ? "!border-amber-300 text-amber-200" : ""}`}
        onClick={() => onToggle(!open)}
        aria-pressed={open}
      >
        <span className="text-base leading-none">↺</span>
        წინა სვლა
      </button>
    </div>
  );
}

/** The last collected trick: who played what and who took it. */
function LastTrick({
  trick,
  onClose,
}: {
  trick: NonNullable<GameState["lastTrick"]>;
  onClose: () => void;
}) {
  const names = usePlayerNames();
  return (
    <div className="panel last-trick-pop absolute bottom-full left-0 z-10 mb-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-6 text-xs font-bold">
        <span>
          წინა სვლა · იღებს <span className="text-amber-300">{names[trick.winner]}</span>
        </span>
        <button className="px-1 text-base leading-none opacity-70" onClick={onClose} aria-label="დახურვა">
          ×
        </button>
      </div>
      <div className="flex gap-2">
        {trick.plays.map((p) => (
          <div key={p.card.id} className="flex flex-col items-center gap-1">
            <div className="relative">
              <CardView
                // A joker given away ("გატანება") lies face down.
                card={p.card.joker && p.mode === "low" ? undefined : p.card}
                size="sm"
                className={p.player === trick.winner ? "win-glow" : ""}
              />
              {p.card.joker && <JokerBadge mode={p.mode} suit={p.suit} small />}
            </div>
            <span className="mt-1 text-[0.65rem] opacity-80">{names[p.player]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
