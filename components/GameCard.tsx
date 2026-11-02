import Link from "next/link";
import type { Card } from "@/lib/joker/cards";
import { CardView } from "./CardView";

/** What the three-card fan of a menu card does when it is hovered or pressed: spread, tilt and lift the middle card. */
const FAN_ITEM =
  "absolute bottom-0 left-1/2 origin-bottom transition-[rotate,translate,bottom] duration-500 ease-out " +
  "[--gap:calc(var(--fan-cw)*0.48)] [--spread:9deg] " +
  "group-hover:[--gap:calc(var(--fan-cw)*0.69)] group-hover:[--spread:17deg] " +
  "group-active:[--gap:calc(var(--fan-cw)*0.69)] group-active:[--spread:17deg]";

function Fan({ cards, front }: { cards: Card[]; front?: number }) {
  return (
    <div className="relative h-24 w-full [--fan-cw:3.4rem] sm:h-44 sm:[--fan-cw:clamp(5.5rem,14vw,7.5rem)]">
      {cards.map((card, i) => (
        <div
          key={card.id}
          className={`${FAN_ITEM} ${i === 1 ? "group-hover:bottom-4 group-active:bottom-4" : ""}`}
          style={{
            rotate: `calc(${i - 1} * var(--spread))`,
            translate: `calc(-50% + ${i - 1} * var(--gap)) 0`,
            // the card in `front` stays on top of its neighbours, which sit a little smaller behind it
            zIndex: i === front ? cards.length + 1 : i,
            scale: front === undefined || i === front ? undefined : "0.92",
          }}
        >
          <CardView card={card} style={{ "--cw": "var(--fan-cw)" } as React.CSSProperties} />
        </div>
      ))}
    </div>
  );
}

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, className: "size-5 flex-none" } as const;

function BotIcon() {
  return (
    <svg viewBox="0 0 24 24" {...ICON}>
      <rect x="4" y="8" width="16" height="11" rx="3" />
      <path d="M12 8V4.5M9 13h.01M15 13h.01M9.5 16.5h5" />
      <circle cx="12" cy="3.5" r="1" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" {...ICON}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
    </svg>
  );
}

export interface GameCardProps {
  title: string;
  /** The game's hub (all modes); the picture and the title lead there. */
  href: string;
  cards: Card[];
  /** Index of the card that stays in front of the others (the joker). */
  front?: number;
  /** The game's colour: the glow and the border when the card is hovered. */
  accent: string;
  /** Small chips under the title: players, online, bots. */
  badges: string[];
  /** The player's own numbers in this game, or a short description when there are none. */
  line: string;
  /** Lobbies waiting for someone right now. */
  waiting?: number;
  waitingText?: string;
  /** A game of the player's that is still running: the way back to it. */
  resume?: { href: string; text: string };
  botsHref: string;
  botsText: string;
  /** Absent when online play is not available (no database). */
  online?: { href: string; text: string };
}

/** One game of the main menu: a card fan, chips, the player's numbers, and two ways in (vs bots, online). */
export function GameCard({ title, href, cards, front, accent, badges, line, waiting, waitingText, resume, botsHref, botsText, online }: GameCardProps) {
  return (
    <div
      className="group relative flex min-w-0 flex-col rounded-[2rem] border border-[var(--accent-soft)] bg-gradient-to-b from-white/[0.09] to-white/[0.02] p-4 shadow-[0_18px_40px_-24px_rgb(0_0_0/0.7)] transition-[translate,border-color,box-shadow] duration-300 ease-out hover:-translate-y-2 hover:border-[var(--accent)] hover:shadow-[0_30px_60px_-20px_rgb(0_0_0/0.6)] focus-within:border-amber-300 sm:p-7 lg:min-h-[min(30rem,56dvh)]"
      style={{ ["--accent" as string]: `${accent}aa`, ["--accent-soft" as string]: `${accent}44` }}
    >
      {/* the glow is clipped on its own layer: clipping the card itself makes its rounded border jagged */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div
          className="absolute -right-16 -top-16 size-56 rounded-full blur-3xl transition-opacity duration-500 sm:-right-12 sm:-top-12 sm:size-80"
          style={{ background: `${accent}59` }}
        />
      </div>
      <Link href={href} className="flex flex-1 items-center gap-4 outline-none sm:flex-col sm:items-stretch sm:gap-0" aria-label={title}>
        <div className="relative w-28 flex-none sm:grid sm:w-auto sm:flex-1 sm:place-items-center sm:py-6">
          <Fan cards={cards} front={front} />
        </div>
        <div className="min-w-0 flex-1 sm:flex-none">
          <h2 className="text-2xl font-extrabold min-[400px]:text-3xl sm:text-5xl">{title}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <span key={b} className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white/70">
                {b}
              </span>
            ))}
          </div>
          {/* reserved rows: the numbers arrive after the page is drawn and must not push the buttons down */}
          <div className="mt-1.5 h-6">
            {waiting ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-300" />
                {waitingText}
              </span>
            ) : null}
          </div>
          <p className="min-h-10 text-sm text-white/55">{line}</p>
        </div>
      </Link>

      <div className="mt-4 flex flex-col gap-2">
        {resume && (
          <Link href={resume.href} className="flex items-center justify-between gap-3 rounded-full border border-emerald-400/50 bg-emerald-400/10 px-5 py-2.5 text-base font-extrabold text-emerald-300 transition-colors hover:bg-emerald-400/20">
            {resume.text}
            <span>→</span>
          </Link>
        )}
        <div className="flex gap-2">
          <Link href={botsHref} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 px-3 py-2.5 text-sm font-bold text-white/80 transition-colors hover:border-white/50 hover:bg-white/10 min-[400px]:text-base">
            <BotIcon />
            {botsText}
          </Link>
          {online && (
            <Link href={online.href} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-amber-300 px-3 py-2.5 text-center text-sm font-extrabold text-black transition-colors hover:bg-amber-200 min-[400px]:text-base">
              <GlobeIcon />
              {online.text}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
