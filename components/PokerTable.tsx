"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { NormalCard } from "@/lib/joker/cards";
import { bestHand, CATEGORY_NAME } from "@/lib/poker/eval";
import { HUMAN, optionsFor, potOf, STREET_NAME, type PokerAction, type PokerState } from "@/lib/poker/engine";
import { playCheck, playChips, playChipsSlide, playDeal, playFlip, playFold, playTurn, playWin, setSoundOn, soundOn } from "@/lib/pokerSound";
import { Avatar } from "./Avatar";
import { CardView } from "./CardView";
import { MusicPlayer, ROUND_BTN, SpeakerIcon } from "./MusicPlayer";
import type { SeatAvatar } from "./names";

interface Props {
  game: PokerState;
  /** The other players, clockwise from the human: bots, or the people at an online table. */
  opponents: { name: string; color?: string; icon?: string; url?: string | null }[];
  me: { name: string; avatar: SeatAvatar | null };
  secondsLeft: number | null;
  onPlay: (action: PokerAction) => void;
  onNext: () => void;
  /** Online: the server deals the next hand by itself, so there is no button for it. */
  autoNext?: boolean;
  onQuit: () => void;
}

type Pos = [number, number];

/** Where the opponents sit around the table (percent of the table area), clockwise from the lower left. */
const SEATS: Record<number, Pos[]> = {
  1: [[50, 13]],
  2: [[24, 17], [76, 17]],
  3: [[11, 46], [50, 11], [89, 46]],
  4: [[11, 64], [26, 15], [74, 15], [89, 64]],
  5: [[11, 68], [11, 26], [50, 9], [89, 26], [89, 68]],
};
/** The pot. */
const POT: Pos = [50, 47];
/** The human's chips lie at the bottom of the table: the bet in the middle, the stack to its left. */
const MY_BET: Pos = [60, 80];
const MY_STACK: Pos = [26, 80];

/** A bet lies between its player and the middle of the table (further for the seats along the top edge). */
const betSpot = ([x, y]: Pos): Pos => {
  const top = Math.abs(x - 50) < 22 && y < 30;
  return [x + (50 - x) * (top ? 0.2 : 0.45), y + (46 - y) * (top ? 0.62 : 0.45)];
};

/** A player's pile of chips lies on the table in front of the seat. */
const stackSpot = ([x, y]: Pos): Pos => {
  const top = Math.abs(x - 50) < 22 && y < 30;
  return top ? [x + (50 - x) * 0.45 + 12, y + 10] : [x + (50 - x) * 0.3, y + (46 - y) * 0.3 + 4];
};

const LAST: Record<string, string> = {
  check: "ჩეკი",
  call: "ქოლი",
  bet: "ბეთი",
  raise: "რეიზი",
  fold: "ფოლდი",
  allin: "ოლ-ინი",
};

/** A number that rolls to its new value instead of jumping. */
function useRolling(value: number, ms = 600): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    if (a === value) return;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const v = Math.round(a + (value - a) * (1 - Math.pow(1 - k, 3)));
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/** Chip colours by value, the way a casino sorts them: [value, colour, colour of the edge stripes]. */
const DENOMS: [number, string, string][] = [
  [1000, "#d4a017", "#fff"],
  [500, "#7c3aed", "#fff"],
  [100, "#1c1c22", "#fff"],
  [25, "#15803d", "#fff"],
  [10, "#1d4ed8", "#fff"],
  [5, "#c62828", "#fff"],
  [1, "#f1f1ee", "#8b8b93"],
];

const chipStyle = (c: string, e: string, size?: string) => ({ "--c": c, "--e": e, ...(size ? { "--chip": size } : {}) }) as React.CSSProperties;

/** A single gold chip: the unit of every number at the table. */
function Coin({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`pk-chip ${className}`} style={chipStyle("#d4a017", "#fff", "0.8rem")} />;
}

/** The chips of an amount, sorted into coloured stacks by value. */
function ChipStack({ amount, size = "1.5rem" }: { amount: number; size?: string }) {
  // Every point is a real chip: the biggest chip used is a third of the amount at most, so a pile is never one lonely chip.
  const stacks: { c: string; e: string; n: number }[] = [];
  let rest = amount;
  const top = DENOMS.findIndex(([value]) => value * 3 <= amount);
  for (const [value, c, e] of DENOMS.slice(top < 0 ? DENOMS.length - 1 : top)) {
    const n = Math.floor(rest / value);
    rest -= n * value;
    // a tall pile is split into columns of five
    for (let left = n; left > 0; left -= 5) stacks.push({ c, e, n: Math.min(left, 5) });
  }
  return (
    <span aria-hidden className="flex items-end gap-[0.1em]" style={{ fontSize: size }}>
      {stacks.map((s, i) => (
        <span key={i} className="relative block" style={{ width: "1em", height: `calc(1em + ${(s.n - 1) * 0.16}em)` }}>
          {Array.from({ length: s.n }, (_, k) => (
            <span key={k} className="pk-chip absolute left-0" style={{ ...chipStyle(s.c, s.e, "1em"), bottom: `${k * 0.16}em` }} />
          ))}
        </span>
      ))}
    </span>
  );
}

/** A stack of chips that rolls and flashes (green up, red down) when it changes. */
function Stack({ value, out }: { value: number; out?: boolean }) {
  const shown = useRolling(value);
  const prev = useRef(value);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (value === prev.current) return;
    const d = value > prev.current ? "up" : "down";
    prev.current = value;
    const t = setTimeout(() => {
      setDir(d);
      setTick((k) => k + 1);
    }, 0);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <span className="flex items-center justify-center gap-1 text-[0.7rem] font-bold tabular-nums sm:text-xs">
      <Coin />
      <span key={tick} className={dir === "up" ? "pk-up" : dir === "down" ? "pk-down" : ""}>
        {out ? "გავარდა" : shown}
      </span>
    </span>
  );
}

/** A chip stack flying across the table: from a bet to the pot, or from the pot to the winner. */
interface Flight {
  id: number;
  from: Pos;
  to: Pos;
  amount: number;
  delay: number;
}

function FlyingChips({ flight, onDone }: { flight: Flight; onDone: (id: number) => void }) {
  // 0 waiting at the start, 1 on the way, 2 arrived and fading out
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 30 + flight.delay),
      setTimeout(() => setPhase(2), 730 + flight.delay),
      setTimeout(() => onDone(flight.id), 1100 + flight.delay),
    ];
    return () => timers.forEach(clearTimeout);
  }, [flight, onDone]);
  const [x, y] = phase >= 1 ? flight.to : flight.from;
  return (
    <span
      className="pointer-events-none absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-[0.7rem] font-bold tabular-nums"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        opacity: phase === 0 ? (flight.delay > 0 ? 0 : 1) : phase === 1 ? 1 : 0,
        transition: "left 0.7s cubic-bezier(0.5, 0, 0.3, 1), top 0.7s cubic-bezier(0.5, 0, 0.3, 1), opacity 0.3s ease-out",
      }}
    >
      <ChipStack amount={flight.amount} size="1.3rem" />
      <span className="rounded-full bg-black/60 px-1.5">{flight.amount}</span>
    </span>
  );
}

function Seat({
  game,
  index,
  name,
  avatar,
  pos,
}: {
  game: PokerState;
  index: number;
  name: string;
  avatar: SeatAvatar | null;
  pos: Pos;
}) {
  const [x, y] = pos;
  const n = game.seats.length;
  const seat = game.seats[index];
  const active = game.phase === "betting" && game.turn === index;
  const won = game.result?.payouts.find((p) => p.seat === index);
  const revealed = game.result?.revealed.includes(index) ?? false;
  const label = seat.last && LAST[seat.last] ? LAST[seat.last] : null;
  const cw = "clamp(1.35rem, min(6vw, 5.5dvh), 2.1rem)";
  const hasCards = !seat.out && seat.hole.length > 0;
  const [bx, by] = betSpot(pos);
  const [sx, sy] = stackSpot(pos);
  // Cards are dealt one by one around the table, starting with the dealer's left.
  const order = (index - game.dealer - 1 + n) % n;
  const dx = `${(50 - x) * 0.8}vw`;
  const dy = `${(46 - y) * 0.5}dvh`;

  return (
    <>
      <div
        className={`absolute z-10 flex w-[clamp(4.4rem,21vw,7rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-opacity duration-500 ${seat.out ? "opacity-30" : seat.folded ? "opacity-55" : ""}`}
        style={{ left: `${x}%`, top: `${y}%` }}
      >
        {hasCards && (
          <div
            className="-mb-3 flex items-end justify-center transition-[opacity,transform] duration-500"
            style={{ opacity: seat.folded ? 0.35 : 1, transform: seat.folded ? "translateY(0.6rem) scale(0.8)" : undefined }}
          >
            {seat.hole.map((c, i) => (
              <div
                key={`${game.handNo}-${c.id}`}
                className="pk-deal"
                style={
                  {
                    marginLeft: i === 0 ? 0 : `calc(${cw} * -0.3)`,
                    rotate: `${i === 0 ? -6 : 6}deg`,
                    "--dx": dx,
                    "--dy": dy,
                    "--d": `${(i * n + order) * 90}ms`,
                  } as React.CSSProperties
                }
              >
                <div className={revealed ? "pk-flip" : ""}>
                  <CardView card={revealed ? c : undefined} style={{ "--cw": cw } as React.CSSProperties} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div
          className={`relative z-10 rounded-full p-0.5 transition-shadow ${
            won ? "pk-glow shadow-[0_0_0_3px_#6ee7b7,0_0_20px_#6ee7b7aa]" : active ? "pk-turn shadow-[0_0_0_3px_#e8c46a,0_0_18px_rgb(232_196_106/0.7)]" : ""
          }`}
        >
          <Avatar size="sm" color={avatar?.color} icon={avatar?.icon} url={avatar?.url} />
          {index === game.dealer && !seat.out && (
            <span
              key={game.handNo}
              title="დილერი"
              className="pk-pop absolute -right-2 -top-1 grid size-5 place-items-center rounded-full bg-white text-[0.65rem] font-black text-black shadow"
            >
              D
            </span>
          )}
        </div>
        <div className="relative z-10 -mt-1.5 w-full rounded-xl bg-black/65 px-1.5 pb-1 pt-2 text-center backdrop-blur-sm">
          <b className="block truncate text-[0.72rem] leading-tight sm:text-sm">{name}</b>
          <Stack value={seat.stack} out={seat.out} />
        </div>
        {(won || label) && (
          <span
            key={won ? `w${won.amount}` : `${seat.last}-${seat.bet}`}
            className={`relative z-10 mt-0.5 rounded-full px-2 py-0.5 text-[0.65rem] font-extrabold ${won ? "pk-win" : "pk-pop"} ${
              won ? "bg-emerald-300 text-black" : seat.folded ? "bg-white/10 text-white/70" : "bg-white/90 text-black"
            }`}
          >
            {won ? `+${won.amount}` : label}
          </span>
        )}
        {index === game.smallBlindSeat && game.street === 0 && !seat.out && <span className="mt-0.5 text-[0.6rem] font-bold text-sky-300">SB</span>}
        {index === game.bigBlindSeat && game.street === 0 && !seat.out && <span className="mt-0.5 text-[0.6rem] font-bold text-amber-300">BB</span>}
      </div>
      {seat.stack > 0 && (
        <span className="absolute z-[5] flex -translate-x-1/2 -translate-y-1/2 items-end" style={{ left: `${sx}%`, top: `${sy}%` }}>
          <ChipStack amount={seat.stack} size="clamp(0.6rem, 2.3vw, 0.9rem)" />
        </span>
      )}
      {seat.bet > 0 && (
        <span
          key={seat.bet}
          className="pk-bet absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-[0.7rem] font-bold tabular-nums"
          style={{ left: `${bx}%`, top: `${by}%`, "--bx": `${(x - bx) * 0.8}vw`, "--by": `${(y - by) * 0.5}dvh` } as React.CSSProperties}
        >
          <ChipStack amount={seat.bet} size="clamp(0.95rem, 4vw, 1.3rem)" />
          <span className="rounded-full bg-black/55 px-1.5">{seat.bet}</span>
        </span>
      )}
    </>
  );
}

const slot = "aspect-[5/7] rounded-[calc(var(--cw)*0.11)] border border-dashed border-white/20 bg-black/10";

/** Coins bursting out of the human's seat after a win. */
function CoinBurst() {
  const coins = Array.from({ length: 16 }, (_, i) => ({
    cx: `${Math.round(Math.sin(i * 2.4) * 7)}rem`,
    cy: `${-4 - ((i * 37) % 6)}rem`,
    cr: `${(i % 2 ? 1 : -1) * 360}deg`,
    d: `${(i % 5) * 90}ms`,
    denom: DENOMS[i % DENOMS.length],
  }));
  return (
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 z-30">
      {coins.map((c, i) => (
        <span
          key={i}
          className="pk-coin pk-chip absolute"
          style={{ ...chipStyle(c.denom[1], c.denom[2], "1.1rem"), "--cx": c.cx, "--cy": c.cy, "--cr": c.cr, "--d": c.d } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export function PokerTable({ game, opponents, me, secondsLeft, onPlay, onNext, autoNext, onQuit }: Props) {
  const names = [me.name, ...opponents.map((b) => b.name)];
  const avatars: (SeatAvatar | null)[] = [me.avatar, ...opponents.map((b) => ({ color: b.color, icon: b.icon, url: b.url }))];
  const mine = game.seats[HUMAN];
  const myTurn = game.phase === "betting" && game.turn === HUMAN;
  const o = myTurn ? optionsFor(game) : null;
  const pot = potOf(game);
  const potShown = useRolling(pot);
  const result = game.result;
  const positions = SEATS[game.seats.length - 1] ?? SEATS[5];
  const n = game.seats.length;

  // The amount chosen for a raise: forgotten as soon as the situation changes.
  const raiseKey = `${game.handNo}:${game.street}:${game.currentBet}`;
  const [chosen, setChosen] = useState<{ key: string; to: number }>({ key: "", to: 0 });
  const raiseTo = o ? Math.min(o.maxRaiseTo, Math.max(o.minRaiseTo, chosen.key === raiseKey ? chosen.to : o.minRaiseTo)) : 0;
  const setRaise = (to: number) => setChosen({ key: raiseKey, to });
  const potRaise = (fraction: number) => game.currentBet + Math.round((pot + (o?.toCall ?? 0)) * fraction);

  const [confirmQuit, setConfirmQuit] = useState(false);

  // Chips fly to the pot when a round of betting ends, and from the pot to the winners when the hand does.
  const [flights, setFlights] = useState<Flight[]>([]);
  const previous = useRef<PokerState | null>(null);
  const flightId = useRef(0);
  useEffect(() => {
    const before = previous.current;
    previous.current = game;
    if (!before || before.handNo !== game.handNo || before.phase !== "betting") return;
    const spot = (i: number): Pos => (i === HUMAN ? MY_BET : betSpot(positions[i - 1] ?? [50, 10]));
    const seatSpot = (i: number): Pos => (i === HUMAN ? MY_STACK : stackSpot(positions[i - 1] ?? [50, 10]));
    const next: Flight[] = [];
    const roundOver = game.street > before.street || game.phase === "handEnd";
    if (roundOver) {
      before.seats.forEach((p, i) => {
        if (p.bet > 0) next.push({ id: ++flightId.current, from: spot(i), to: POT, amount: p.bet, delay: 0 });
      });
    }
    if (game.phase === "handEnd" && game.result) {
      for (const p of game.result.payouts) next.push({ id: ++flightId.current, from: POT, to: seatSpot(p.seat), amount: p.amount, delay: 650 });
    }
    if (next.length === 0) return;
    const t = setTimeout(() => setFlights((f) => [...f, ...next]), 0);
    return () => clearTimeout(t);
  }, [game, positions]);
  const landed = (id: number) => setFlights((f) => f.filter((x) => x.id !== id));

  // Sounds follow what changed since the last state: the deal, each move, cards turning, chips moving, a win.
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMuted(!soundOn()), 0);
    return () => clearTimeout(t);
  }, []);
  const toggleSound = () => {
    setSoundOn(muted);
    setMuted(!muted);
  };
  const heard = useRef<PokerState | null>(null);
  useEffect(() => {
    const before = heard.current;
    if (before === game) return;
    heard.current = game;
    const at = (ms: number, fn: () => void) => void setTimeout(fn, ms);
    if (!before || before.handNo !== game.handNo) {
      for (let k = 0; k < game.seats.length * 2; k++) at(k * 90, playDeal);
    } else if (before.phase === "betting") {
      const last = game.seats[before.turn]?.last;
      if (last === "check") playCheck();
      else if (last === "fold") playFold();
      else if (last) playChips(last === "allin" ? 8 : last === "call" ? 3 : 5);
      const roundOver = game.street > before.street || game.phase === "handEnd";
      if (roundOver && before.seats.some((p) => p.bet > 0)) at(260, () => playChips(6));
      for (let k = 0; k < game.community.length - before.community.length; k++) at(500 + k * 200, playFlip);
      if (game.phase === "handEnd" && game.result) {
        at(900, playChipsSlide);
        if (game.result.payouts.some((p) => p.seat === HUMAN)) at(1100, playWin);
      }
    }
    if (game.phase === "betting" && game.turn === HUMAN && (!before || before.phase !== "betting" || before.turn !== HUMAN)) at(400, playTurn);
  }, [game]);

  // Cards turn over one after the other; those already on the board stay put.
  const [seen, setSeen] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setSeen(game.community.length), 0);
    return () => clearTimeout(t);
  }, [game.community.length]);
  const fresh = game.community.length < seen ? 0 : seen;

  const made =
    !mine.out && !mine.folded && mine.hole.length > 0 ? CATEGORY_NAME[bestHand([...mine.hole, ...game.community]).value.category] : null;
  const winningCards = new Set(result?.showdown ? result.payouts.flatMap((p) => p.best) : []);
  const thinking = game.phase === "betting" && !myTurn ? names[game.turn] : null;
  const raiseWord = o?.opening ? "ბეთი" : "რეიზი";
  const allInRaise = o ? raiseTo >= o.maxRaiseTo : false;
  const step = game.config.smallBlind;
  const iWon = result?.payouts.some((p) => p.seat === HUMAN) ?? false;

  const board = Array.from({ length: 5 }, (_, i) => game.community[i] as NormalCard | undefined);
  const boardCw = "clamp(1.9rem, min(11.5vw, 12dvh), 4.4rem)";
  const myCw = "clamp(3.2rem, min(17vw, 15dvh), 6rem)";

  return (
    <main className="pk-room relative flex h-dvh cursor-default select-none flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-3 py-2 short:py-1">
        <div className="flex min-w-0 items-center gap-2 text-xs sm:text-sm">
          <span className="chip px-3 py-1 font-bold">Texas Hold&apos;em</span>
          <span className="hidden text-white/60 min-[420px]:inline">
            ბლაინდები {game.config.smallBlind}/{game.config.bigBlind} · ხელი {game.handNo}
          </span>
        </div>
        {confirmQuit ? (
          <div className="flex items-center gap-2 text-sm">
            <button className="rounded-full bg-red-500/80 px-3 py-1.5 font-bold" onClick={onQuit}>
              გასვლა
            </button>
            <button className="rounded-full bg-white/10 px-3 py-1.5 font-bold" onClick={() => setConfirmQuit(false)}>
              დარჩენა
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <MusicPlayer />
            <button className={ROUND_BTN} onClick={toggleSound} aria-pressed={!muted} aria-label={muted ? "ხმის ჩართვა" : "ხმის გამორთვა"}>
              <SpeakerIcon off={muted} />
            </button>
            <button className="btn !px-3 !py-1" onClick={() => setConfirmQuit(true)}>
              გასვლა
            </button>
          </div>
        )}
      </header>

      {/* the table: an oval of felt, the opponents around it, the board and the pot in the middle */}
      <section className="relative mx-auto min-h-0 w-full max-w-5xl flex-1">
        {/* leather rail with a gold pinstripe, then the felt with a faint betting line and a watermark */}
        <div className="absolute inset-x-[4%] inset-y-[5%] rounded-[50%] bg-[linear-gradient(165deg,#3b2214,#140a06_55%,#2e1a0f)] p-[0.6rem] shadow-[0_14px_36px_rgb(0_0_0/0.6),inset_0_2px_3px_rgb(255_255_255/0.12)] sm:p-3.5">
          <div className="relative size-full overflow-hidden rounded-[50%] bg-[radial-gradient(ellipse_at_50%_42%,#1f8556,#0e4a2d_60%,#082d1b)] shadow-[0_0_0_2px_#c9a24a,inset_0_0_50px_rgb(0_0_0/0.6)]">
            <div className="absolute inset-[9%] rounded-[50%] border border-white/10" />
            <span className="absolute left-1/2 top-[70%] -translate-x-1/2 -translate-y-1/2 text-[clamp(1rem,5vw,2rem)] font-black uppercase tracking-[0.3em] text-white/[0.07]">
              ProJoker
            </span>
          </div>
        </div>

        {game.seats.slice(1).map((_, k) => (
          <Seat key={k + 1} game={game} index={k + 1} name={names[k + 1]} avatar={avatars[k + 1]} pos={positions[k] ?? [50, 10]} />
        ))}

        <div className="absolute left-1/2 top-[47%] z-10 flex w-full max-w-[26rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 px-2 text-center short:gap-0.5">
          <div className="flex min-h-[1.5rem] items-end justify-center">{pot > 0 && <ChipStack amount={pot} size="clamp(1rem, 4.5vw, 1.5rem)" />}</div>
          <span className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-sm font-extrabold tabular-nums ring-1 ring-amber-300/30 sm:text-base">
            ბანკი {potShown}
          </span>
          <div className="flex items-center justify-center gap-[0.25rem] sm:gap-1.5" style={{ "--cw": boardCw } as React.CSSProperties}>
            {board.map((c, i) => (
              <div key={i} className="w-[var(--cw)]" style={{ perspective: "600px" }}>
                {c ? (
                  <div className="pk-board" style={{ "--d": `${Math.max(0, i - fresh) * 200}ms` } as React.CSSProperties}>
                    <CardView
                      card={c}
                      className={winningCards.size > 0 ? (winningCards.has(c.id) ? "win-glow" : "!opacity-50") : ""}
                      style={{ "--cw": boardCw } as React.CSSProperties}
                    />
                  </div>
                ) : (
                  <div className={slot} style={{ "--cw": boardCw } as React.CSSProperties} />
                )}
              </div>
            ))}
          </div>
          {!result && <p className="text-[0.7rem] font-bold uppercase tracking-wider text-white/55 sm:text-xs">{STREET_NAME[game.street]}</p>}
          {thinking && (
            <p className="text-xs font-bold text-amber-200 sm:text-sm">
              {thinking} ფიქრობს
              <span className="pk-dots">
                <i>.</i>
                <i>.</i>
                <i>.</i>
              </span>
            </p>
          )}
          {result && (
            <div key={game.handNo} className="panel pk-pop flex max-w-sm flex-col items-center gap-0.5 px-3 py-2 text-xs sm:text-sm">
              {result.payouts.map((p) => (
                <p key={p.seat} className="font-bold">
                  <span className="text-amber-300">{names[p.seat]}</span> იღებს {p.amount}
                  {p.value && <span className="text-white/70"> · {CATEGORY_NAME[p.value.category]}</span>}
                  {!result.showdown && <span className="text-white/60"> · დანარჩენებმა გადაყარეს</span>}
                </p>
              ))}
              {!autoNext && (
                <button className="btn btn-primary mt-1 !py-1 text-xs" onClick={onNext}>
                  შემდეგი ხელი →
                </button>
              )}
            </div>
          )}
        </div>

        {mine.stack > 0 && (
          <span className="absolute z-[5] flex -translate-x-1/2 -translate-y-1/2 items-end" style={{ left: `${MY_STACK[0]}%`, top: `${MY_STACK[1]}%` }}>
            <ChipStack amount={mine.stack} size="clamp(0.7rem, 2.6vw, 1rem)" />
          </span>
        )}
        {mine.bet > 0 && (
          <span
            key={mine.bet}
            className="pk-bet absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-[0.7rem] font-bold tabular-nums"
            style={{ left: `${MY_BET[0]}%`, top: `${MY_BET[1]}%`, "--bx": "0px", "--by": "6dvh" } as React.CSSProperties}
          >
            <ChipStack amount={mine.bet} size="clamp(1rem, 4vw, 1.4rem)" />
            <span className="rounded-full bg-black/55 px-1.5">{mine.bet}</span>
          </span>
        )}
        {flights.map((f) => (
          <FlyingChips key={f.id} flight={f} onDone={landed} />
        ))}
      </section>

      <footer className="mx-auto flex w-full max-w-3xl flex-col items-center gap-1.5 px-2 pb-3 short:flex-row short:items-end short:justify-center short:gap-4 short:pb-1">
        <div className="relative flex flex-col items-center gap-1.5">
          {iWon && <CoinBurst key={game.handNo} />}
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs sm:text-sm">
            <div
              className={`flex items-center gap-2 rounded-2xl border bg-black/35 px-2.5 py-1 transition-shadow ${
                myTurn ? "pk-turn border-amber-300 shadow-[0_0_16px_rgb(232_196_106/0.55)]" : "border-white/15"
              }`}
            >
              <Avatar size="tag" color={me.avatar?.color} icon={me.avatar?.icon} url={me.avatar?.url} />
              <b className="max-w-28 truncate">{me.name}</b>
              <Stack value={mine.stack} />
              {mine.bet > 0 && (
                <span key={mine.bet} className="pk-pop flex items-center gap-1 rounded-full bg-black/40 px-1.5 py-0.5 font-bold tabular-nums">
                  <ChipStack amount={mine.bet} size="0.9rem" />
                  {mine.bet}
                </span>
              )}
              {HUMAN === game.dealer && <span className="grid size-5 place-items-center rounded-full bg-white text-[0.65rem] font-black text-black">D</span>}
              {HUMAN === game.smallBlindSeat && game.street === 0 && <span className="text-[0.65rem] font-bold text-sky-300">SB</span>}
              {HUMAN === game.bigBlindSeat && game.street === 0 && <span className="text-[0.65rem] font-bold text-amber-300">BB</span>}
            </div>
            {made && (
              <span key={made} className="pk-pop rounded-full bg-white/10 px-3 py-1 font-bold text-amber-200">
                {made}
              </span>
            )}
            {myTurn && secondsLeft !== null && (
              <span className={`rounded-full px-2.5 py-1 font-extrabold tabular-nums ${secondsLeft <= 10 ? "animate-pulse bg-red-500/30 text-red-200" : "bg-black/30 text-white/70"}`}>
                {secondsLeft}
              </span>
            )}
            {mine.folded && !mine.out && <span className="text-white/60">გადაყარეთ</span>}
          </div>

          <div className="flex items-end justify-center gap-2">
            {mine.hole.map((c, i) => (
              <div
                key={`${game.handNo}-${c.id}`}
                className="pk-deal"
                style={{ "--dx": "0px", "--dy": "-45dvh", "--rot": "-240deg", "--d": `${(i * n + ((HUMAN - game.dealer - 1 + n) % n)) * 90}ms` } as React.CSSProperties}
              >
                <CardView
                  card={c}
                  style={{ "--cw": myCw } as React.CSSProperties}
                  className={`transition-[opacity,transform] duration-500 ${mine.folded ? "!opacity-45 translate-y-2" : ""} ${winningCards.has(c.id) ? "win-glow" : ""}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* the room for the moves is always reserved (so the table never changes size); on wide screens it sits at the left */}
        <div className="flex min-h-[8.7rem] w-full max-w-md flex-col items-stretch justify-end gap-2 pt-1 short:max-w-[15rem] short:pb-1 lg:absolute lg:bottom-4 lg:left-1/2 lg:-ml-[26rem] lg:min-h-0 lg:w-72 lg:max-w-none lg:rounded-2xl lg:p-3 lg:[&:has(*)]:bg-black/30">
          {myTurn && o && (
            <div key={raiseKey} className="pk-up-bar flex flex-col gap-2">
              {o.canRaise && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={o.minRaiseTo}
                      max={o.maxRaiseTo}
                      step={Math.max(1, Math.min(step, o.maxRaiseTo - o.minRaiseTo || 1))}
                      value={raiseTo}
                      onChange={(e) => setRaise(Number(e.target.value))}
                      aria-label="ფსონის ზომა"
                      className="h-2 min-w-0 flex-1 cursor-pointer accent-amber-300"
                    />
                    <span className="w-16 text-right text-sm font-extrabold tabular-nums text-amber-200">{raiseTo}</span>
                  </div>
                  <div className="flex gap-1.5 text-xs font-bold">
                    {[
                      ["½ ბანკი", potRaise(0.5)],
                      ["ბანკი", potRaise(1)],
                      ["მაქსიმუმი", o.maxRaiseTo],
                    ].map(([label, to]) => (
                      <button
                        key={label}
                        type="button"
                        className="flex-1 rounded-full border border-white/20 py-1 transition-colors hover:border-amber-300 hover:text-amber-300"
                        onClick={() => setRaise(Number(to))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex min-h-11 gap-2">
                <button className="btn flex-1 !px-2 !py-2.5 !text-base" onClick={() => onPlay({ type: "fold" })}>
                  ფოლდი
                </button>
                {o.canCheck ? (
                  <button className="btn flex-1 !px-2 !py-2.5 !text-base" onClick={() => onPlay({ type: "check" })}>
                    ჩეკი
                  </button>
                ) : (
                  <button className="btn flex-1 !px-2 !py-2.5 !text-base" onClick={() => onPlay({ type: "call" })}>
                    ქოლი {o.callCost}
                    {o.callCost < o.toCall ? " · ოლ-ინ" : ""}
                  </button>
                )}
                <button
                  className="btn btn-primary flex-[1.3] !px-2 !py-2.5 !text-base"
                  disabled={!o.canRaise}
                  onClick={() => onPlay({ type: "raise", to: raiseTo })}
                >
                  {allInRaise ? `ოლ-ინ ${raiseTo}` : `${raiseWord} ${raiseTo}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </footer>

      {game.phase === "gameEnd" && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-3">
          <div className="panel pk-pop flex w-full max-w-sm flex-col items-center gap-3 p-5 text-center">
            <h2 className="text-2xl font-extrabold text-amber-200">
              {game.winner === HUMAN ? "გილოცავთ, ყველა ჩიპი თქვენია! 🎉" : game.winner === null ? "ჩიპები გაგითავდათ" : `${names[game.winner]} დარჩა ერთადერთი`}
            </h2>
            <p className="text-white/70">{game.handNo} ხელი ითამაშეთ.</p>
            <button className="btn btn-primary w-full" onClick={onQuit}>
              ახალი თამაში
            </button>
            <Link href="/" className="btn block w-full text-center">
              მთავარი მენიუ
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
