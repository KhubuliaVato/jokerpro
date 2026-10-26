"use client";

import { useState } from "react";
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
import { CardView } from "./CardView";
import { PLAYER_NAMES } from "./names";
import { ScoreSheet } from "./ScoreSheet";

interface Props {
  game: GameState;
  secondsLeft: number | null;
  onBid: (n: number) => void;
  onTrump: (suit: Suit | null) => void;
  onPlay: (option: PlayOption) => void;
  onQuit: () => void;
}

const SEAT_CLASS = [
  "bottom-0 left-1/2 -translate-x-1/2",
  "left-0 top-1/2 -translate-y-1/2",
  "top-0 left-1/2 -translate-x-1/2",
  "right-0 top-1/2 -translate-y-1/2",
];
const SEAT_FROM = ["1.5rem", "-1.5rem", "-1.5rem", "1.5rem"];

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
  const bid = game.bids[seat];
  const active =
    game.turn === seat && (game.phase === "bidding" || game.phase === "playing" || game.phase === "trump");
  // The player left of the dealer opens the hand: first to bid and first to lead.
  const starts =
    seat === (game.dealer + 1) % PLAYERS &&
    game.phase !== "trickEnd" &&
    game.hands[HUMAN].length === game.cards &&
    game.trick.length === 0;

  const avatar = (
    <span
      className={`grid size-8 flex-none place-items-center rounded-full bg-gradient-to-br text-sm font-extrabold text-black/80 shadow-inner ring-2 ${AVATAR[seat]} ${active ? "ring-amber-300" : "ring-white/30"}`}
    >
      {PLAYER_NAMES[seat][0]}
    </span>
  );
  const score =
    bid === null ? null : (
      <span className={`flex items-center gap-2 text-xs tabular-nums ${compact ? "justify-center" : ""}`}>
        <span title="ნათქვამი">
          <span className="opacity-60">ნათ.</span> <b className="text-sm">{bid}</b>
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
        <b className="text-sm leading-none">{PLAYER_NAMES[seat]}</b>
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

function TrickArea({ game }: { game: GameState }) {
  return (
    <div className="relative h-[min(17rem,36dvh)] w-full max-w-[26rem]">
      {game.trick.map((p) => (
        <div key={p.card.id} className={`absolute ${SEAT_CLASS[p.player]}`}>
          <div
            className="drop-in relative"
            style={{ "--from": SEAT_FROM[p.player] } as React.CSSProperties}
          >
            <CardView
              card={p.card}
              size="sm"
              className={game.trickWinner === p.player ? "win-glow" : ""}
            />
            {p.card.joker && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-1.5 py-0.5 text-[0.6rem] font-bold">
                {p.mode === "high" ? "მოჯოკვრა" : "გატანება"}
                {p.suit && (
                  <span className={suitColor(p.suit)}> {SUIT_SYMBOL[p.suit]}</span>
                )}
              </span>
            )}
          </div>
        </div>
      ))}
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

export function Table({ game, secondsLeft, onBid, onTrump, onPlay, onQuit }: Props) {
  // The pending joker choice only counts for the position it was made in.
  const moveKey = `${game.handIndex}:${game.played.length}`;
  const [pick, setPick] = useState<{ card: Card; key: string } | null>(null);
  const jokerPick = pick && pick.key === moveKey ? pick.card : null;
  const setJokerPick = (card: Card | null) => setPick(card && { card, key: moveKey });
  const [lastOpen, setLastOpen] = useState(false);

  const sums = totals(game);
  const loc = locateHand(game.rules, game.handIndex);
  const pulkas = schedule(game.rules.format);
  const myTurn = game.turn === HUMAN;
  const canPlay = game.phase === "playing" && myTurn;
  const options = canPlay ? legalPlays(game, HUMAN) : [];
  const playable = new Set(options.map((o) => o.card.id));
  const myHand = sortHand(game.hands[HUMAN]);

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
    status = myTurn ? "აირჩიეთ კოზირი" : `${PLAYER_NAMES[game.turn]} ირჩევს კოზირს…`;
  } else if (game.phase === "bidding") {
    status = myTurn ? "თქვენი დაკვეთა" : `${PLAYER_NAMES[game.turn]} ფიქრობს…`;
  } else if (game.phase === "playing") {
    status = myTurn ? "თქვენი სვლა" : `${PLAYER_NAMES[game.turn]} ფიქრობს…`;
  } else if (game.phase === "trickEnd" && game.trickWinner !== null) {
    status =
      game.trickWinner === HUMAN
        ? "ხელი თქვენია"
        : `ხელს იღებს ${PLAYER_NAMES[game.trickWinner]}`;
  }

  const bidChoices = game.phase === "bidding" && myTurn ? legalBids(game, HUMAN) : [];
  const jokerOptions = jokerPick
    ? options.filter((o) => o.card.id === jokerPick.id)
    : [];
  const leading = game.trick.length === 0;

  return (
    <main className="felt flex h-dvh flex-col overflow-hidden">
      <header className="flex items-start justify-between gap-2 px-3 py-2 text-xs sm:text-sm">
        <div className="flex flex-col gap-1.5">
          <Scoreboard sums={sums} game={game} />
          <div className="chip px-2.5 py-1 text-[0.7rem] sm:text-xs">
            პულკა {loc.pulka + 1}/{pulkas.length} · ხელი {loc.inPulka + 1}/{loc.pulkaLength} ·{" "}
            {loc.cards} კარტი
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            className="btn !px-3 !py-1"
            onClick={() => window.confirm("დარწმუნებული ხართ? თამაში შეწყდება.") && onQuit()}
          >
            გასვლა
          </button>
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
        <div className="grid place-items-center">
          <TrickArea game={game} />
        </div>
        <div className="flex w-[5rem] flex-col items-center gap-2 sm:w-28">
          <PlayerTag game={game} seat={3} compact />
          <OpponentHand count={game.hands[3].length} seat={3} />
        </div>
      </section>

      <footer className="flex flex-col items-center gap-2 px-2 pb-3">
        {myTurn && (game.phase === "bidding" || game.phase === "trump") ? (
          <div className="panel flex w-full max-w-md flex-col items-center gap-3 px-4 py-3.5 sm:px-6">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-extrabold text-amber-200 sm:text-lg">
                {game.phase === "trump" ? "აირჩიეთ კოზირი" : "თქვენი დაკვეთა"}
              </h3>
              {secondsLeft !== null && <TurnTimer left={secondsLeft} />}
            </div>

            {game.phase === "trump" ? (
              <div className="flex flex-wrap justify-center gap-2">
                {SUITS.map((s) => (
                  <button key={s} className="bid-btn !h-14 !px-4" onClick={() => onTrump(s)}>
                    <span className="flex items-center gap-2">
                      <span className={`text-3xl ${suitColor(s)}`}>{SUIT_SYMBOL[s]}</span>
                      <span className="text-xs font-bold">{SUIT_NAME[s]}</span>
                    </span>
                  </button>
                ))}
                <button className="bid-btn !h-14" onClick={() => onTrump(null)}>
                  უკოზიროდ
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap justify-center gap-2">
                  {Array.from({ length: game.cards + 1 }, (_, n) => (
                    <button
                      key={n}
                      className="bid-btn"
                      disabled={!bidChoices.includes(n)}
                      onClick={() => onBid(n)}
                    >
                      {n === 0 ? "პასი" : n}
                    </button>
                  ))}
                </div>
                {bidChoices.length < game.cards + 1 && (
                  <p className="text-center text-xs opacity-70">
                    გადახაზული რიცხვი ბოლო დამკვეთს ეკრძალება: ჯამი არ უნდა გაუტოლდეს ხელების რაოდენობას
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex min-h-9 items-center gap-3 text-sm font-bold text-amber-200">
            {status}
            {myTurn && secondsLeft !== null && <TurnTimer left={secondsLeft} />}
          </div>
        )}

        {jokerPick && canPlay && (
          <div className="panel flex flex-col items-center gap-2 p-2">
            <div className="text-sm font-bold">ჯოკერი</div>
            {(["high", "low"] as const).map((mode) => (
              <div key={mode} className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="w-24 text-sm">
                  {mode === "high" ? "მოჯოკვრა" : "გატანება"}
                </span>
                {leading ? (
                  jokerOptions
                    .filter((o) => o.mode === mode)
                    .map((o) => (
                      <button
                        key={o.suit}
                        className="btn !px-3 !py-1"
                        onClick={() => playJoker(o)}
                      >
                        <span className={`text-lg ${suitColor(o.suit as Suit)}`}>
                          {SUIT_SYMBOL[o.suit as Suit]}
                        </span>
                      </button>
                    ))
                ) : (
                  <button
                    className="btn !px-3 !py-1"
                    onClick={() => playJoker(jokerOptions.find((o) => o.mode === mode)!)}
                  >
                    დადება
                  </button>
                )}
              </div>
            ))}
            <button className="text-xs underline opacity-70" onClick={() => setJokerPick(null)}>
              გაუქმება
            </button>
          </div>
        )}

        <PlayerTag game={game} seat={HUMAN} />
        <div className="flex max-w-full justify-center px-2 pt-3">
          <div className="relative flex items-end">
            {myHand.map((card) => {
              const ok = canPlay && playable.has(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  className={`hand-card ${ok ? "playable" : ""} ${canPlay && !ok ? "dim" : ""} ${jokerPick?.id === card.id ? "glow" : ""}`}
                  onClick={() => clickCard(card)}
                  disabled={!ok}
                  aria-label={card.joker ? "ჯოკერი" : card.id}
                >
                  <CardView card={card} />
                </button>
              );
            })}
            {game.lastTrick && (
              <div className="absolute bottom-1 left-full ml-8 sm:ml-20">
                {lastOpen && (
                  <LastTrick trick={game.lastTrick} onClose={() => setLastOpen(false)} />
                )}
                <button
                  type="button"
                  className="group/last flex flex-col items-center gap-2.5"
                  onClick={() => setLastOpen((v) => !v)}
                  aria-pressed={lastOpen}
                >
                  <span className="relative block">
                    <span className="pc back sm block !absolute -left-2 top-0 -rotate-12 opacity-60 transition-transform group-hover/last:-rotate-[16deg]" />
                    <span
                      className={`pc back sm block rotate-6 transition-transform group-hover/last:-translate-y-1.5 group-hover/last:rotate-0 ${lastOpen ? "win-glow !rotate-0 -translate-y-1.5" : ""}`}
                    />
                    <span className="absolute inset-0 grid place-items-center text-3xl text-white drop-shadow-[0_2px_4px_rgb(0_0_0/0.6)]">
                      ↺
                    </span>
                  </span>
                  <span
                    className={`chip whitespace-nowrap px-3 py-1 text-xs font-bold ${lastOpen ? "!border-amber-300 text-amber-200" : ""}`}
                  >
                    წინა სვლა
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </footer>

      {game.phase === "gameEnd" && (
        <Overlay>
          <h2 className="mb-2 text-center text-xl font-extrabold text-amber-200">
            თამაში დასრულდა
          </h2>
          <Standings sums={sums} />
          <ScoreSheet game={game} />
          <button className="btn btn-primary mt-3 w-full" onClick={onQuit}>
            ახალი თამაში
          </button>
        </Overlay>
      )}
    </main>
  );
}

function Standings({ sums }: { sums: number[] }) {
  const order = Array.from({ length: PLAYERS }, (_, p) => p).sort((a, b) => sums[b] - sums[a]);
  return (
    <ol className="mb-3 flex flex-col gap-1 text-center">
      {order.map((p, i) => (
        <li key={p} className={i === 0 ? "text-lg font-bold text-amber-300" : ""}>
          {i + 1}. {PLAYER_NAMES[p]} — {sums[p]}
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
          {PLAYER_NAMES.map((name, p) => (
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
                    {PLAYER_NAMES.map((name) => (
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
                              <span>{bid}</span>
                              <span className={bid === taken ? GOOD : BAD}>{taken}</span>
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

/** The last collected trick: who played what and who took it. */
function LastTrick({
  trick,
  onClose,
}: {
  trick: NonNullable<GameState["lastTrick"]>;
  onClose: () => void;
}) {
  return (
    <div className="panel absolute bottom-full right-0 z-10 mb-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-6 text-xs font-bold">
        <span>
          წინა სვლა · იღებს <span className="text-amber-300">{PLAYER_NAMES[trick.winner]}</span>
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
                card={p.card}
                size="sm"
                className={p.player === trick.winner ? "win-glow" : ""}
              />
              {p.card.joker && (
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-1 py-0.5 text-[0.55rem] font-bold">
                  {p.mode === "high" ? "მოჯოკვრა" : "გატანება"}
                  {p.suit && <span className={suitColor(p.suit)}> {SUIT_SYMBOL[p.suit]}</span>}
                </span>
              )}
            </div>
            <span className="mt-1 text-[0.65rem] opacity-80">{PLAYER_NAMES[p.player]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
