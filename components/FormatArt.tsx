import { tt } from "@/lib/i18n";
import type { Card, Suit } from "@/lib/joker/cards";
import { CardView } from "./CardView";

const nine = (suit: Suit, id: string): Card => ({ joker: false, suit, rank: 9, id });
const card = (suit: Suit, rank: number): Card => ({ joker: false, suit, rank: rank as 6, id: `${suit}${rank}` });

/** Each game length is shown by a few cards and a short name. */
export const FORMAT_ART = {
  nine: {
    get title() {
      return tt("ცხრიანები", "Nines", "Девятки");
    },
    cards: [nine("S", "S9"), nine("H", "H9"), nine("D", "D9"), nine("C", "C9")],
  },
  full: {
    get title() {
      return tt("სტანდარტული", "Standard", "Стандартная");
    },
    cards: [
      { joker: false, suit: "S", rank: 14, id: "S14" } as Card,
      { joker: true, id: "J0" } as Card,
      { joker: false, suit: "H", rank: 13, id: "H13" } as Card,
    ],
  },
  // Bura: by the number of players
  p2: {
    get title() {
      return tt("2 მოთამაშე", "2 players", "2 игрока");
    },
    cards: [card("H", 14), card("H", 10)],
  },
  p4: {
    get title() {
      return tt("4 მოთამაშე · 2×2", "4 players · 2×2", "4 игрока · 2×2");
    },
    cards: [card("H", 14), card("S", 13), card("H", 10), card("D", 12)],
  },
} as const;

/** The cards of a format fanned out; they spread a little when an ancestor with the `group` class is hovered. */
export function FormatFan({
  format,
  cardWidth = "clamp(4.4rem, 11vw, 6rem)",
  className = "h-44",
}: {
  format: keyof typeof FORMAT_ART;
  cardWidth?: string;
  className?: string;
}) {
  const cards = FORMAT_ART[format].cards;
  const size = { ["--cw" as string]: cardWidth } as React.CSSProperties;
  return (
    <span className={`relative mx-auto block w-full max-w-xs ${className}`}>
      {cards.map((card, i) => {
        const d = i - (cards.length - 1) / 2;
        return (
          <span
            key={card.id}
            className="absolute bottom-0 left-1/2 block origin-bottom transition-[rotate,translate] duration-500 ease-out [--gap:calc(var(--cw)*0.5)] [--spread:11deg] group-hover:[--gap:calc(var(--cw)*0.7)] group-hover:[--spread:15deg]"
            style={
              {
                ...size,
                zIndex: i,
                rotate: `calc(${d} * var(--spread))`,
                translate: `calc(-50% + ${d} * var(--gap)) 0`,
              } as React.CSSProperties
            }
          >
            <CardView card={card} style={size} />
          </span>
        );
      })}
    </span>
  );
}
