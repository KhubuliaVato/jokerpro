"use client";

import { tt, useLang } from "@/lib/i18n";
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
import {
  DEFAULT_VOLUME,
  playCardSound,
  playDealSound,
  setMasterVolume,
} from "@/lib/sound";
import { Avatar } from "./Avatar";
import { CardView } from "./CardView";
import { MusicPlayer } from "./MusicPlayer";
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

// Hand fan: the pivot's depth below a card (% of its height). The angle between neighbours follows from how far
// apart the cards should sit, which depends on how many are left (see fanStep).
const FAN_PIVOT = 700;

/**
 * Degrees between neighbouring cards. A full hand overlaps tightly (each card shows about a third of its width);
 * the fewer cards remain, the further they spread, until three or fewer lie side by side with a gap.
 */
function fanStep(cards: number): number {
  const apart = Math.min(1.15, 0.34 + (9 - cards) * 0.1); // distance between neighbours, in card widths
  const pivotDepth = (FAN_PIVOT / 100) * 1.4; // in card widths (a card is 1.4 times as tall as it is wide)
  return (Math.atan(apart / pivotDepth) * 180) / Math.PI;
}

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
  side,
}: {
  game: GameState;
  seat: number;
  compact?: boolean;
  /** Next to the pile of its own cards at the side of the table: on a phone avatar, name and numbers stack up. */
  side?: boolean;
}) {
  const avatars = usePlayerAvatars();
  const names = usePlayerNames();
  const bid = game.bids[seat];
  const active =
    game.turn === seat &&
    (game.phase === "bidding" ||
      game.phase === "playing" ||
      game.phase === "trump");
  // The player left of the dealer opens the hand: first to bid and first to lead.
  const starts =
    seat === (game.dealer + 1) % PLAYERS &&
    game.phase !== "trickEnd" &&
    game.hands[HUMAN].length === game.cards &&
    game.trick.length === 0;

  const photo = avatars?.[seat];
  const avatar = photo ? (
    <Avatar
      size={compact ? "tag" : "sm"}
      color={photo.color}
      icon={photo.icon}
      url={photo.url}
    />
  ) : (
    <span
      className={`grid ${compact ? "size-6 wide:size-8" : "size-8"} flex-none place-items-center rounded-full bg-gradient-to-br text-sm font-extrabold text-black/80 shadow-inner ring-2 ${AVATAR[seat]} ${active ? "ring-amber-300" : "ring-white/30"}`}
    >
      {names[seat][0]}
    </span>
  );
  const taken = game.taken[seat];
  const score =
    bid === null ? null : (
      <span
        className={`flex items-center gap-1 whitespace-nowrap tabular-nums sm:gap-1.5 ${
          side
            ? "w-full flex-col !gap-1"
            : compact
              ? "col-span-2 justify-center wide:col-span-1"
              : ""
        }`}
      >
        <span
          title={tt("ნათქვამი", "Bid", "Заказ")}
          className={`flex items-baseline gap-1 rounded-lg bg-white/10 px-1.5 py-0.5 leading-none ${side ? "w-full justify-between px-2.5 py-1" : ""}`}
        >
          <span className="text-[0.62rem] font-semibold uppercase text-white/55">
            {tt("ნათ.", "Bid", "Зак.")}
          </span>
          <b className="text-base font-extrabold sm:text-lg">
            {bid === 0 ? "—" : bid}
          </b>
        </span>
        <span
          title={tt("წაღებული", "Taken", "Взято")}
          className={`flex items-baseline gap-1 rounded-lg px-1.5 py-0.5 leading-none ${side ? "w-full justify-between px-2.5 py-1" : ""} ${
            taken === bid
              ? "bg-emerald-400/25"
              : taken > bid
                ? "bg-red-400/25"
                : "bg-white/10"
          }`}
        >
          <span className="text-[0.62rem] font-semibold uppercase text-white/55">
            {tt("წაღ.", "Won", "Взят.")}
          </span>
          <b
            className={`text-base font-extrabold sm:text-lg ${taken === bid ? "text-emerald-300" : taken > bid ? "text-red-300" : ""}`}
          >
            {taken}
          </b>
        </span>
      </span>
    );
  const startBadge = starts && (
    <span
      className={`rounded-full bg-amber-300 px-2 py-0.5 text-[0.65rem] font-extrabold text-black ${
        compact
          ? "absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap wide:static wide:translate-x-0"
          : ""
      }`}
    >
      ▶ {tt("იწყებს", "Leads", "Заходит")}
    </span>
  );

  return (
    <div
      className={`rounded-2xl border bg-black/35 backdrop-blur-sm transition-shadow ${
        active
          ? "border-amber-300 shadow-[0_0_16px_rgb(232_196_106/0.55)]"
          : "border-white/15"
      } ${compact ? `relative ${side ? "flex flex-col items-center gap-0.5 px-1 py-1.5" : "grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1 gap-y-0.5 px-1 py-1.5 min-[360px]:gap-x-1.5 min-[360px]:px-1.5"} wide:flex wide:flex-col wide:gap-1 wide:px-2 wide:py-2 short:flex short:flex-row short:justify-center short:gap-1.5 short:px-2 short:py-1` : "flex items-center gap-2.5 px-3 py-1.5"}`}
    >
      {avatar}
      <span
        className={
          compact
            ? "contents wide:flex wide:flex-col wide:items-center wide:gap-1 short:flex short:min-w-0 short:flex-row short:items-center short:gap-1.5"
            : "flex flex-col gap-0.5"
        }
      >
        <b
          className={`leading-none ${compact ? `truncate wide:text-sm ${side ? "max-w-full text-[0.66rem] min-[400px]:text-[0.8rem]" : "text-[0.72rem] min-[360px]:text-[0.8rem]"}` : "text-sm"}`}
        >
          {names[seat]}
        </b>
        {score}
      </span>
      {startBadge}
    </div>
  );
}

/** How far the bids are from the cards dealt: more bids than tricks is "stuffed", fewer is "torn". */
function bidBalance(game: GameState): { over: boolean; n: number } | null {
  if (game.bids.some((b) => b === null)) return null;
  const sum = game.bids.reduce<number>((t, b) => t + (b ?? 0), 0);
  return sum === game.cards
    ? null
    : { over: sum > game.cards, n: Math.abs(sum - game.cards) };
}

function BidBalance({
  game,
  className = "",
}: {
  game: GameState;
  className?: string;
}) {
  const bal = bidBalance(game);
  if (!bal) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-extrabold leading-none ${
        bal.over ? "bg-red-400/20 text-red-200" : "bg-sky-400/20 text-sky-200"
      } ${className}`}
    >
      {bal.over
        ? tt("შეტენვა", "Over", "Перебор")
        : tt("წაგლეჯვა", "Under", "Недобор")}
      <b className="text-sm">
        {bal.over ? "+" : "−"}
        {bal.n}
      </b>
    </span>
  );
}

function TrumpInfo({ game }: { game: GameState }) {
  const { phase, trump, trumpCard } = game;
  return (
    <div className="panel flex items-center px-3 py-2 sm:px-4 sm:py-2.5 tight:px-3 tight:py-1">
      <div className="flex items-center gap-3 tight:gap-2">
        <span className="rotate-180 text-xs font-bold tracking-wide opacity-70 [writing-mode:vertical-rl] tight:hidden">
          {tt("კოზირი", "Trump", "Козырь")}
        </span>
        {phase === "trump" ? (
          <span className="text-sm opacity-80">
            {tt("ირჩევა…", "Choosing…", "Выбирает…")}
          </span>
        ) : (
          <>
            <span className="flex flex-col items-center gap-1.5">
              {trumpCard && (
                <CardView card={trumpCard} size="sm" className="tight:!hidden" />
              )}
              <BidBalance game={game} />
            </span>
            {trump ? (
              <span
                className={`flex flex-col items-center leading-none tight:flex-row tight:gap-1.5 ${suitColor(trump)}`}
              >
                <span className="text-4xl sm:text-5xl tight:text-3xl">
                  {SUIT_SYMBOL[trump]}
                </span>
                <span className="mt-1 text-xs font-bold sm:text-sm tight:mt-0">
                  {SUIT_NAME[trump]}
                </span>
              </span>
            ) : (
              <span className="text-center text-base font-extrabold leading-tight sm:text-xl">
                {tt("კოზირის", "No", "Без")}
                <br />
                {tt("გარეშე", "trump", "козыря")}
              </span>
            )}
          </>
        )}
      </div>
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
  const label = suit
    ? mode === "high"
      ? tt("მაღალი", "High", "Старшая")
      : tt("წაიღოს", "Take", "Взять")
    : mode === "high"
      ? tt("მოჯოკვრა", "Mojokvra", "Моджокра")
      : tt("გატანება", "Gatana", "Гатана");
  return (
    <span
      className={`absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-black/85 font-extrabold text-amber-200 ring-1 ring-amber-300/60 ${
        small
          ? "-bottom-2 px-1.5 py-0.5 text-[0.55rem]"
          : "-bottom-3 px-2.5 py-1 text-xs"
      }`}
    >
      {label}
      {suit && (
        <span
          className={`${small ? "text-xs" : "text-base"} leading-none ${isRed(suit) ? "text-red-400" : "text-white"}`}
        >
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
    <div className="relative h-full max-h-[17rem] w-full max-w-[26rem] [--tcw:clamp(2.6rem,min(15vw,calc((100dvh-24.5rem)/3.2)),6.2rem)] wide:[--tcw:clamp(3.4rem,min(15vw,11.5dvh),6.2rem)]">
      <style>{`@keyframes deal-in{from{opacity:0;transform:translate(var(--fx),var(--fy)) scale(.8)}to{opacity:1;transform:none}}@keyframes take-trick{to{translate:calc(-50% + var(--tcw) * var(--tx)) calc(-50% + var(--tcw) * var(--ty));scale:.55;opacity:0}}`}</style>
      {game.trick.map((p, i) => {
        const slot = TRICK_SLOT[p.player];
        const from = TRICK_FROM[p.player];
        // Once the winner is shown, the trick glides over to them and fades out.
        const take =
          game.phase === "trickEnd" && game.trickWinner !== null
            ? TRICK_TAKE[game.trickWinner]
            : null;
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
                  animation:
                    "deal-in 0.34s cubic-bezier(0.2, 0.9, 0.3, 1) both",
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
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-3">
      <div className="panel max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto p-4 sm:p-5">
        {children}
      </div>
    </div>
  );
}

export function Table({
  game,
  secondsLeft,
  onBid,
  onTrump,
  onPlay,
  onQuit,
  endNote,
  quitConfirm,
}: Props) {
  useLang(); // the table re-renders when the language is switched
  const names = usePlayerNames();
  // The pending joker choice only counts for the position it was made in.
  const moveKey = `${game.handIndex}:${game.played.length}`;
  const [pick, setPick] = useState<{ card: Card; key: string } | null>(null);
  const jokerPick = pick && pick.key === moveKey ? pick.card : null;
  const setJokerPick = (card: Card | null) =>
    setPick(card && { card, key: moveKey });

  // The joker menu closes on any click outside it (and on Escape).
  const jokerOpen = jokerPick !== null;
  useEffect(() => {
    if (!jokerOpen) return;
    const close = (e: Event) => {
      if (
        e instanceof KeyboardEvent
          ? e.key === "Escape"
          : !(e.target as Element).closest("[data-joker]")
      ) {
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
  const waiting = !(
    myTurn &&
    (game.phase === "bidding" ||
      game.phase === "trump" ||
      game.phase === "playing")
  );

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
    status = myTurn
      ? ""
      : tt(
          `${names[game.turn]} ირჩევს კოზირს…`,
          `${names[game.turn]} is choosing the trump…`,
          `${names[game.turn]} выбирает козырь…`,
        );
  } else if (game.phase === "bidding") {
    status = myTurn
      ? ""
      : tt(
          `${names[game.turn]} ფიქრობს…`,
          `${names[game.turn]} is thinking…`,
          `${names[game.turn]} думает…`,
        );
  } else if (game.phase === "playing") {
    status = myTurn
      ? tt("თქვენი სვლა", "Your move", "Ваш ход")
      : tt(
          `${names[game.turn]} ფიქრობს…`,
          `${names[game.turn]} is thinking…`,
          `${names[game.turn]} думает…`,
        );
  } else if (game.phase === "trickEnd" && game.trickWinner !== null) {
    status =
      game.trickWinner === HUMAN
        ? tt("ხელი თქვენია", "You take the trick", "Взятка ваша")
        : tt(
            `ხელს იღებს ${names[game.trickWinner]}`,
            `${names[game.trickWinner]} takes the trick`,
            `Взятку берёт ${names[game.trickWinner]}`,
          );
  }

  const bidChoices =
    game.phase === "bidding" && myTurn ? legalBids(game, HUMAN) : [];
  const jokerOptions = jokerPick
    ? options.filter((o) => o.card.id === jokerPick.id)
    : [];
  const leading = game.trick.length === 0;

  return (
    <main className="felt relative flex h-dvh cursor-default select-none flex-col overflow-hidden">
      {/* two columns, two rows: scores and the controls on top, the stage and the trump under them (so nothing runs off a phone's edge) */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1.5 px-3 py-2 text-xs sm:text-sm tight:flex tight:gap-2 tight:py-1.5">
        <div className="order-1 min-w-0 sm:order-none tight:order-1 tight:w-[min(19rem,38vw)] tight:flex-none">
          <Scoreboard sums={sums} game={game} />
        </div>
        <div className="order-2 flex items-center gap-1.5 justify-self-end sm:order-none sm:gap-2 tight:order-4 tight:ml-auto">
          <MusicPlayer />
          {/* on narrow phones the scoreboard gets the room (the phone has its own volume keys) */}
          <div className="max-[400px]:hidden">
            <VolumeControl volume={volume} onChange={setVolume} />
          </div>
          <button
            className="btn !px-3 !py-1 max-sm:grid max-sm:size-9 max-sm:place-items-center max-sm:!p-0"
            aria-label={tt("გასვლა", "Leave", "Выйти")}
            onClick={() =>
              window.confirm(
                quitConfirm ??
                  tt(
                    "დარწმუნებული ხართ? თამაში შეწყდება.",
                    "Are you sure? The game will end.",
                    "Вы уверены? Игра прервётся.",
                  ),
              ) && onQuit()
            }
          >
            <span className="sm:hidden" aria-hidden>
              ✕
            </span>
            <span className="max-sm:hidden">
              {tt("გასვლა", "Leave", "Выйти")}
            </span>
          </button>
        </div>
        <div className="panel order-3 col-span-2 min-w-0 px-2 pb-2 pt-1.5 sm:order-none sm:col-span-1 tight:col-span-1 sm:w-full sm:max-w-[21rem] tight:order-2 tight:!w-36 tight:flex-none tight:px-3 tight:py-1 tight:max-[680px]:hidden">
          <div className="grid grid-cols-4 gap-1 text-center sm:grid-cols-3 tight:grid-cols-3">
            {(
              [
                [
                  tt("ეტაპი", "Round", "Этап"),
                  String(loc.pulka + 1),
                  String(pulkas.length),
                ],
                [
                  tt("ხელი", "Hand", "Раздача"),
                  String(loc.inPulka + 1),
                  String(loc.pulkaLength),
                ],
                [tt("კარტი", "Cards", "Карты"), String(loc.cards), null],
              ] as [string, string, string | null][]
            ).map(([label, value, total]) => (
              <div
                key={label}
                className="flex flex-col items-center rounded-lg bg-white/[0.06] py-1 leading-tight"
              >
                <span className="text-[0.58rem] font-semibold uppercase tracking-wide text-white/50">
                  {label}
                </span>
                <span className="tabular-nums">
                  <b className="text-base font-extrabold sm:text-lg">{value}</b>
                  {total && (
                    <span className="text-xs text-white/45">/{total}</span>
                  )}
                </span>
              </div>
            ))}
            {/* portrait phones: the trump is one more cell of this strip instead of a panel of its own */}
            <div className="flex flex-col items-center rounded-lg bg-white/[0.06] py-1 leading-tight sm:hidden tight:hidden">
              <span className="text-[0.58rem] font-semibold uppercase tracking-wide text-white/50">
                {tt("კოზირი", "Trump", "Козырь")}
              </span>
              {game.phase === "trump" ? (
                <b className="text-base opacity-70">…</b>
              ) : game.trump ? (
                <b className={`text-base ${suitColor(game.trump)}`}>
                  {SUIT_SYMBOL[game.trump]} {SUIT_NAME[game.trump]}
                </b>
              ) : (
                <b className="whitespace-nowrap text-[0.7rem]">
                  {tt("კოზირის გარეშე", "No trump", "Без козыря")}
                </b>
              )}
              <BidBalance game={game} className="mt-0.5 self-center" />
            </div>
          </div>
          {/* one segment per round, filled as its hands are played */}
          <div className="mt-1.5 flex gap-1 tight:hidden">
            {pulkas.map((pl, i) => {
              const before = pulkas
                .slice(0, i)
                .reduce((t, x) => t + x.length, 0);
              const f = Math.min(
                1,
                Math.max(0, (game.handIndex - before) / pl.length),
              );
              return (
                <div
                  key={i}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-400 transition-[width] duration-500"
                    style={{ width: `${f * 100}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="order-4 hidden justify-self-end sm:order-none sm:block tight:order-3 tight:block">
          <TrumpInfo game={game} />
        </div>
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_1fr] items-center gap-x-2 px-2">
        <div className="col-span-3 flex w-full flex-col items-center gap-1 [@media(min-width:1100px)_and_(min-height:821px)]:absolute [@media(min-width:1100px)_and_(min-height:821px)]:left-1/2 [@media(min-width:1100px)_and_(min-height:821px)]:top-2 [@media(min-width:1100px)_and_(min-height:821px)]:z-10 [@media(min-width:1100px)_and_(min-height:821px)]:w-auto [@media(min-width:1100px)_and_(min-height:821px)]:-translate-x-1/2">
          {/* landscape phones: no room beside the stage, so the three opponents sit side by side on top */}
          <div className="hidden w-full grid-cols-3 gap-1.5 short:mx-auto short:grid short:max-w-xl">
            <PlayerTag game={game} seat={1} compact />
            <PlayerTag game={game} seat={2} compact />
            <PlayerTag game={game} seat={3} compact />
          </div>
          {/* portrait phones: every opponent next to their own cards; this one is above the cards across the table */}
          <div className="w-[min(13rem,60vw)] wide:hidden short:hidden">
            <PlayerTag game={game} seat={2} compact />
          </div>
          <div className="hidden wide:block">
            <PlayerTag game={game} seat={2} />
          </div>
          {/* the fan across the table only where there is height for it */}
          <div className="hidden wide:block [@media(min-height:760px)]:block">
            <OpponentHand count={game.hands[2].length} seat={2} />
          </div>
        </div>
        <div className="col-start-1 row-start-2 flex w-[4.9rem] flex-col items-center gap-2 wide:w-28 short:hidden">
          <div className="w-full">
            <PlayerTag game={game} seat={1} compact side />
          </div>
          <OpponentHand count={game.hands[1].length} seat={1} />
        </div>
        <div className="relative col-start-2 row-start-2 grid self-stretch place-items-center">
          <TrickArea game={game} />
        </div>
        <div className="col-start-3 row-start-2 flex w-[4.9rem] flex-col items-center gap-2 wide:w-28 short:hidden">
          <div className="w-full">
            <PlayerTag game={game} seat={3} compact side />
          </div>
          <OpponentHand count={game.hands[3].length} seat={3} />
        </div>
        {/* phones: the status line sits at the bottom of the stage */}
        <div className="pointer-events-none relative col-span-3 col-start-1 row-start-2 flex items-end justify-center self-stretch wide:hidden">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-200">
            {status}
            {myTurn && game.phase === "playing" && secondsLeft !== null && (
              <TurnTimer left={secondsLeft} />
            )}
          </div>
        </div>
        {/* the pickers float over the whole stage, not just its middle column */}
        <div className="relative col-span-3 col-start-1 row-start-2 self-stretch">
          {myTurn && game.phase === "trump" && (
            <TrumpPicker secondsLeft={secondsLeft} onPick={onTrump} />
          )}
          {jokerPick && canPlay && (
            <JokerMenu
              leading={leading}
              options={jokerOptions}
              onPick={playJoker}
            />
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
      </section>

      <footer className="relative flex flex-col items-center gap-1.5 px-2 pb-2 sm:gap-2 sm:pb-3">
        <div className="hidden min-h-9 items-center gap-3 text-sm font-bold text-amber-200 wide:flex">
          {status}
          {myTurn && game.phase === "playing" && secondsLeft !== null && (
            <TurnTimer left={secondsLeft} />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 sm:hidden short:hidden">
          <PlayerTag game={game} seat={HUMAN} />
        </div>
        <div className="absolute bottom-3 left-3 hidden flex-col items-start gap-2 sm:flex short:flex">
          <PlayerTag game={game} seat={HUMAN} />
        </div>
        {/* the previous trick: low on the right, beside the hand and clear of the status line */}
        {game.lastTrick && (
          <div className="absolute bottom-[4.75rem] right-3 z-10 short:bottom-16">
            <LastTrickDock
              trick={game.lastTrick}
              open={lastOpen}
              onToggle={setLastOpen}
            />
          </div>
        )}
        <div className="flex max-w-full justify-center px-2 pb-6 pt-2 sm:pb-10 sm:pt-3 short:pb-3 short:pt-1">
          <div className="relative flex items-end">
            {myHand.map((card, i) => {
              const ok = canPlay && playable.has(card.id);
              // A true fan: every card sits on the same spot and is turned about a pivot far below the
              // hand, so the spacing comes from the angle and the row forms a tight, even arc.
              const rot =
                (i - (myHand.length - 1) / 2) * fanStep(myHand.length);
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
                  aria-label={
                    card.joker ? tt("ჯოკერი", "Joker", "Джокер") : card.id
                  }
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
            {tt("თამაში დასრულდა", "Game over", "Игра окончена")}
          </h2>
          <Standings sums={sums} />
          {endNote && <div className="mb-3 text-center text-sm">{endNote}</div>}
          <ScoreSheet game={game} />
          <button className="btn btn-primary mt-3 w-full" onClick={onQuit}>
            {tt("ახალი თამაში", "New game", "Новая игра")}
          </button>
          <Link href="/" className="btn mt-2 block w-full text-center">
            {tt("მთავარი მენიუ", "Main menu", "Главное меню")}
          </Link>
        </Overlay>
      )}
    </main>
  );
}

function Standings({ sums }: { sums: number[] }) {
  const names = usePlayerNames();
  const order = Array.from({ length: PLAYERS }, (_, p) => p).sort(
    (a, b) => sums[b] - sums[a],
  );
  return (
    <ol className="mb-3 flex flex-col gap-1 text-center">
      {order.map((p, i) => (
        <li
          key={p}
          className={i === 0 ? "text-lg font-bold text-amber-300" : ""}
        >
          {i + 1}. {names[p]} — {sums[p]}
          {i === 0 && p === HUMAN && " 🎉"}
        </li>
      ))}
    </ol>
  );
}

const GOOD = "text-emerald-300";
const BAD = "text-red-300";
const COLS = "grid grid-cols-4 items-center";

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
    if (
      inPulka === pulkaLength - 1 &&
      game.premiums[h.pulka].some((v) => v > 0)
    ) {
      entries.push({ kind: "premium", pulka: h.pulka });
    }
  });
  entries.reverse();

  return (
    <div className="group relative w-full max-w-[21rem]">
      <button
        type="button"
        onClick={() => setPinned((v) => !v)}
        className="panel block w-full p-1.5 text-left sm:p-2 tight:p-1"
        aria-label={tt("ქულების სია", "Score list", "Таблица очков")}
        aria-expanded={pinned}
      >
        <div className="grid grid-cols-4 gap-1">
          {names.map((name, p) => {
            const lead = sums[p] === top && started;
            return (
              <div
                key={p}
                className={`flex min-w-0 flex-col items-center rounded-xl px-0.5 py-1 leading-tight ring-1 ${
                  lead
                    ? "bg-amber-300/15 ring-amber-300/60"
                    : "bg-white/[0.06] ring-white/10"
                } ${p === HUMAN ? "shadow-[inset_0_-2px_0_rgb(52_211_153/0.75)]" : ""}`}
              >
                <span
                  className={`flex max-w-full items-center gap-0.5 text-[0.66rem] font-semibold min-[360px]:text-[0.72rem] sm:text-xs ${lead ? "text-amber-200" : "text-white/70"}`}
                >
                  {lead && <span aria-hidden>♛</span>}
                  <span className="truncate">{name}</span>
                </span>
                <b
                  className={`text-lg font-black tabular-nums sm:text-2xl tight:!text-lg ${lead ? "text-amber-300" : sums[p] < 0 ? "text-red-300" : ""}`}
                >
                  {sums[p]}
                </b>
              </div>
            );
          })}
        </div>
        <div className="mt-0.5 text-center text-[0.6rem] leading-none opacity-40 transition-opacity group-hover:opacity-0 tight:hidden">
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
            <div className="panel max-h-[55dvh] overflow-y-auto rounded-2xl px-2.5 py-2">
              {entries.length === 0 ? (
                <p className="py-2 text-center text-xs opacity-60">
                  {tt("ქულები პირველი ხელის შემდეგ გამოჩნდება", "Scores appear after the first hand", "Очки появятся после первой раздачи")}
                </p>
              ) : (
                <>
                  <p className="mb-1.5 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-white/45">
                    {tt("ნათქვამი", "Bid", "Заказ")} <span className="text-white/25">/</span> {tt("წაღებული", "Won", "Взято")} · {tt("ქულა", "Points", "Очки")}
                  </p>
                  <div className="flex flex-col gap-1">
                    {entries.map((e) =>
                      e.kind === "premium" ? (
                        <div key={`pr${e.pulka}`} className={`${COLS} relative gap-1 rounded-xl bg-amber-300/10 py-1.5 text-center text-sm font-extrabold text-amber-300 ring-1 ring-amber-300/30`}>
                          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[0.6rem]">★</span>
                          {game.premiums[e.pulka].map((v, p) => (
                            <span key={p} className="tabular-nums">
                              {v > 0 ? `+${v}` : ""}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div key={e.n} className={`${COLS} relative gap-1`}>
                          <span
                            title={tt("კარტი ხელში", "Cards dealt", "Карт в раздаче")}
                            className="absolute -left-1 top-1/2 z-10 grid size-4 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-[0.55rem] font-bold text-white/60 ring-1 ring-white/15"
                          >
                            {e.h.cards}
                          </span>
                          {e.h.bids.map((bid, p) => {
                            const taken = e.h.taken[p];
                            const hit = bid === taken;
                            const pts = e.h.points[p];
                            return (
                              <span
                                key={p}
                                className={`flex flex-col items-center rounded-xl py-1 leading-tight ring-1 ${
                                  hit ? "bg-emerald-400/12 ring-emerald-400/30" : "bg-red-400/10 ring-red-400/25"
                                }`}
                              >
                                <span className="flex items-baseline gap-1 tabular-nums">
                                  <b className="text-base font-extrabold">{bid === 0 ? "—" : bid}</b>
                                  <span className="text-xs text-white/30">/</span>
                                  {bid > 0 && taken === 0 ? (
                                    <b title={tt("ხიშტი", "Khishti", "Хишти")} className="text-base font-extrabold text-red-300">
                                      ✕
                                    </b>
                                  ) : (
                                    <b className={`text-base font-extrabold ${hit ? GOOD : BAD}`}>{taken}</b>
                                  )}
                                </span>
                                <span className={`text-[0.65rem] font-bold tabular-nums ${pts > 0 ? "text-emerald-300/80" : pts < 0 ? "text-red-300/80" : "text-white/40"}`}>
                                  {pts > 0 ? `+${pts}` : pts}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      ),
                    )}
                  </div>
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
      className={`relative grid size-9 flex-none place-items-center sm:size-10 ${urgent ? "animate-pulse text-red-300" : "text-amber-200"}`}
      aria-label={tt(
        `დარჩა ${left} წამი`,
        `${left} seconds left`,
        `Осталось ${left} сек.`,
      )}
    >
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="rgb(0 0 0 / 0.35)"
          stroke="rgb(255 255 255 / 0.15)"
          strokeWidth="3"
        />
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
      <span className="relative text-sm font-extrabold tabular-nums">
        {left}
      </span>
    </span>
  );
}

/** Speaker icon (click to mute / restore) with a volume slider. */
function VolumeControl({
  volume,
  onChange,
}: {
  volume: number;
  onChange: (v: number) => void;
}) {
  const lastAudible = useRef(DEFAULT_VOLUME);
  useEffect(() => {
    if (volume > 0) lastAudible.current = volume;
  }, [volume]);
  const icon =
    volume === 0 ? "🔇" : volume < 0.4 ? "🔈" : volume < 0.75 ? "🔉" : "🔊";
  return (
    <div
      className="chip flex items-center gap-2 !rounded-full px-3 py-1"
      title={tt("ხმა", "Sound", "Звук")}
    >
      <button
        type="button"
        className="text-base leading-none"
        aria-label={
          volume === 0
            ? tt("ხმის ჩართვა", "Unmute", "Включить звук")
            : tt("ხმის გამორთვა", "Mute", "Выключить звук")
        }
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
        aria-label={tt("ხმის სიმაღლე", "Volume", "Громкость")}
        className="hidden h-1 w-16 cursor-pointer accent-amber-300 sm:block sm:w-24 tight:max-[900px]:!hidden"
      />
      <span className="hidden w-8 text-right text-[0.7rem] tabular-nums opacity-70 sm:block tight:max-[900px]:!hidden">
        {Math.round(volume * 100)}%
      </span>
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
      <div className="relative flex max-w-full flex-col items-center gap-2 sm:gap-6 [@media(min-height:700px)]:gap-4">
        <div className="absolute -inset-x-16 -inset-y-12 -z-10 rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_0_0/0.4),transparent)]" />
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="hidden h-px w-16 bg-gradient-to-r from-transparent to-amber-300/80 sm:block" />
          <span className="whitespace-nowrap text-sm font-extrabold text-amber-200 min-[400px]:text-base sm:text-xl">
            {title}
          </span>
          {secondsLeft !== null && <TurnTimer left={secondsLeft} />}
          <span className="hidden h-px w-16 bg-gradient-to-l from-transparent to-amber-300/80 sm:block" />
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
    <PickerStage
      title={tt(
        "რამდენს იტყვით?",
        "How many will you take?",
        "Сколько возьмёте?",
      )}
      secondsLeft={secondsLeft}
    >
      {/* one or two even rows: 6 choices become 3 + 3, not 5 + 1 */}
      <div
        className="pointer-events-auto grid justify-center gap-x-2 gap-y-2 [--bw:clamp(2.6rem,min(15vw,8.5dvh),4.5rem)] [grid-template-columns:repeat(var(--c2),var(--bw))] sm:gap-3 short:[grid-template-columns:repeat(var(--c1),var(--bw))]"
        style={
          {
            "--from": "2rem",
            "--c1": cards + 1,
            "--c2": cards + 1 <= 5 ? cards + 1 : Math.ceil((cards + 1) / 2),
          } as React.CSSProperties
        }
      >
        {Array.from({ length: cards + 1 }, (_, n) => {
          const ok = allowed.includes(n);
          return (
            <button
              key={n}
              disabled={!ok}
              onClick={() => onPick(n)}
              style={{ animationDelay: `${n * 35}ms` }}
              className="group relative block h-[calc(var(--bw)*1.25)] w-[var(--bw)] drop-in disabled:cursor-not-allowed"
              aria-label={n === 0 ? tt("პასი", "Pass", "Пас") : String(n)}
            >
              <span
                className={`grid size-full place-items-center rounded-xl font-extrabold leading-none transition-[translate,box-shadow] duration-200 ease-out ${
                  ok
                    ? "bg-[#fbf8ef] text-neutral-900 shadow-[0_6px_16px_rgb(0_0_0/0.45)] ring-1 ring-black/10 group-hover:-translate-y-3 group-hover:shadow-[0_0_0_3px_#e8c46a,0_16px_24px_rgb(0_0_0/0.45)] group-active:translate-y-0"
                    : "bg-black/20 text-white/25 ring-1 ring-white/10 line-through"
                } ${n === 0 ? "text-[calc(var(--bw)*0.3)]" : "text-[calc(var(--bw)*0.56)]"}`}
              >
                {n === 0 ? tt("პასი", "Pass", "Пас") : n}
              </span>
            </button>
          );
        })}
      </div>
    </PickerStage>
  );
}

/** Trump choice: five big cards dealt onto the table, no words (the joker card means "no trump"). */
const TRUMP_TILE =
  "group relative block h-[calc(var(--tw)*1.5)] w-[var(--tw)] drop-in";

function TrumpPicker({
  secondsLeft,
  onPick,
}: {
  secondsLeft: number | null;
  onPick: (suit: Suit | null) => void;
}) {
  const tiles = [...SUITS, null] as const;
  return (
    <PickerStage
      title={tt("აირჩიეთ კოზირი", "Choose the trump", "Выберите козырь")}
      secondsLeft={secondsLeft}
    >
      <div
        className="pointer-events-auto flex items-start gap-1.5 [--tw:clamp(3.1rem,min(17vw,10dvh),6.5rem)] min-[420px]:gap-2.5 sm:gap-4"
        style={{ "--from": "3rem" } as React.CSSProperties}
      >
        {tiles.map((s, i) => {
          const d = i - 2;
          return (
            <button
              key={s ?? "none"}
              className={TRUMP_TILE}
              // Fan: tilt each card and let the outer ones sit lower, so the row forms a dome.
              style={{
                rotate: `${d * 4}deg`,
                translate: `0 ${d * d * 0.3}rem`,
                animationDelay: `${i * 70}ms`,
              }}
              aria-label={
                s
                  ? SUIT_NAME[s]
                  : tt("კოზირის გარეშე", "No trump", "Без козыря")
              }
              onClick={() => onPick(s)}
            >
              {/* The outer button keeps a fixed hit area; only this face moves on hover. */}
              <span
                className={`flex size-full flex-col items-center justify-center gap-2 rounded-xl leading-none shadow-[0_6px_16px_rgb(0_0_0/0.45)] ring-1 ring-black/10 transition-[translate,box-shadow] duration-200 ease-out group-hover:-translate-y-3 group-hover:shadow-[0_0_0_3px_#e8c46a,0_16px_24px_rgb(0_0_0/0.45)] group-active:translate-y-0 ${s ? "bg-[#fbf8ef]" : "bg-gradient-to-br from-[#fff4e0] via-[#f1ddff] to-[#d9e6ff]"}`}
              >
                <span
                  className={`text-[calc(var(--tw)*0.55)] ${s ? (isRed(s) ? "text-red-600" : "text-neutral-900") : "text-purple-700"}`}
                >
                  {s ? SUIT_SYMBOL[s] : "★"}
                </span>
                <span
                  className={`text-[calc(var(--tw)*0.17)] text-center font-extrabold leading-tight ${s ? (isRed(s) ? "text-red-700" : "text-neutral-800") : "text-purple-800"}`}
                >
                  {s ? (
                    SUIT_NAME[s]
                  ) : (
                    <>
                      {tt("კოზირის", "No", "Без")}
                      <br />
                      {tt("გარეშე", "trump", "козыря")}
                    </>
                  )}
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
      label: leading
        ? tt("მაღალი", "High", "Старшая")
        : tt("მოჯოკვრა", "Mojokvra", "Моджокра"),
    },
    {
      mode: "low",
      label: leading
        ? tt("წაიღოს", "Take", "Взять")
        : tt("გატანება", "Gatana", "Гатана"),
    },
  ] as const;
  return (
    <PickerStage title={tt("ჯოკერი", "Joker", "Джокер")} secondsLeft={null} low>
      <div
        data-joker
        className="pointer-events-auto flex flex-col gap-2 min-[400px]:gap-4"
        style={{ "--from": "2rem" } as React.CSSProperties}
      >
        {leading ? (
          modes.map(({ mode, label }, r) => (
            <div
              key={mode}
              className="drop-in flex items-center gap-2 min-[400px]:gap-4 sm:gap-5"
              style={{ animationDelay: `${r * 80}ms` }}
            >
              <span
                className={`w-[4.5rem] text-sm font-extrabold min-[400px]:w-24 min-[400px]:text-base sm:w-28 sm:text-lg ${mode === "high" ? "text-amber-300" : "text-white"}`}
              >
                {label}
              </span>
              <span className="flex gap-2 min-[400px]:gap-2.5 sm:gap-3">
                {options
                  .filter((o) => o.mode === mode)
                  .map((o) => (
                    <button
                      key={o.suit}
                      onClick={() => onPick(o)}
                      aria-label={`${label} ${SUIT_NAME[o.suit as Suit]}`}
                      title={SUIT_NAME[o.suit as Suit]}
                      className="group relative block size-[clamp(2.4rem,min(10.5vw,9dvh),4rem)]"
                    >
                      <span
                        className={`grid size-full place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fffdf6,#efe8d3)] text-[clamp(1.5rem,6.5vw,2.25rem)] leading-none shadow-[0_3px_8px_rgb(0_0_0/0.45)] transition-[translate,box-shadow] duration-150 ease-out group-hover:-translate-y-1.5 group-hover:shadow-[0_0_0_3px_#e8c46a,0_10px_16px_rgb(0_0_0/0.45)] group-active:translate-y-0 ${
                          mode === "high"
                            ? "ring-[3px] ring-amber-300/90"
                            : "opacity-90 ring-2 ring-white/25"
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
                  className="group relative block h-16 w-[clamp(6rem,38vw,9rem)] drop-in min-[400px]:h-20 sm:h-24 sm:w-44"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <span
                    className={`flex size-full flex-col items-center justify-center gap-1 rounded-2xl shadow-[0_6px_16px_rgb(0_0_0/0.45)] transition-[translate,box-shadow] duration-200 ease-out group-hover:-translate-y-2.5 group-hover:shadow-[0_0_0_3px_#e8c46a,0_16px_24px_rgb(0_0_0/0.45)] group-active:translate-y-0 ${
                      mode === "high"
                        ? "bg-gradient-to-b from-[#f6e3a3] to-[#d9ac3f] text-[#2b2005]"
                        : "bg-[#fbf8ef] text-neutral-900"
                    }`}
                  >
                    <span className="text-xl font-extrabold sm:text-2xl">
                      {label}
                    </span>
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

/** Two cards with a "back" arrow around them. */
function LastTrickIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="size-8 flex-none"
      fill="none"
      aria-hidden
    >
      <rect
        x="4"
        y="9"
        width="14"
        height="19"
        rx="2.5"
        transform="rotate(-12 11 18)"
        fill="#fbf8ef"
        opacity="0.55"
      />
      <rect
        x="11"
        y="7"
        width="14"
        height="19"
        rx="2.5"
        transform="rotate(8 18 16)"
        fill="#fbf8ef"
      />
      <path
        d="M18 12.2c-1.6 1.7-2.9 2.7-2.9 4.3a1.6 1.6 0 0 0 2.8.9c0 .9-.4 1.5-1 1.9h2.4c-.6-.4-1-1-1-1.9a1.6 1.6 0 0 0 2.8-.9c0-1.6-1.3-2.6-2.9-4.3z"
        transform="rotate(8 18 16)"
        fill="#d6443f"
      />
      <path
        d="M7 6.5A11.5 11.5 0 0 1 26 8"
        stroke="#fcd34d"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M5.2 3.6 7 7l3.6-1.4"
        stroke="#fcd34d"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
        className={`chip flex items-center gap-2 whitespace-nowrap py-1.5 pl-2 pr-4 max-sm:pr-2 text-sm font-extrabold shadow-[0_4px_14px_rgb(0_0_0/0.4)] transition-[border-color,color,background-color,translate] hover:-translate-y-0.5 hover:border-amber-300/70 ${
          open
            ? "!border-amber-300 !bg-amber-300/15 text-amber-200"
            : "!bg-black/55"
        }`}
        onClick={() => onToggle(!open)}
        aria-pressed={open}
      >
        <LastTrickIcon />
        <span className="max-sm:hidden short:inline">
          {tt("წინა სვლა", "Last trick", "Прошлая взятка")}
        </span>
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
    <div className="panel last-trick-pop absolute bottom-full right-0 z-10 mb-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-6 text-xs font-bold">
        <span>
          {tt("წინა სვლა", "Last trick", "Прошлая взятка")} ·{" "}
          {tt("იღებს", "taken by", "берёт")}{" "}
          <span className="text-amber-300">{names[trick.winner]}</span>
        </span>
        <button
          className="px-1 text-base leading-none opacity-70"
          onClick={onClose}
          aria-label={tt("დახურვა", "Close", "Закрыть")}
        >
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
            <span className="mt-1 text-[0.65rem] opacity-80">
              {names[p.player]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
