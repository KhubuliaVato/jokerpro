import { isRed, rankLabel, type NormalCard, type Suit } from "@/lib/joker/cards";

const INK = "#141418";
const RED = "#d3141c";

/** Suit outlines on a 100 × 100 grid. */
const SUIT_PATH: Record<Suit, string> = {
  H: "M50 90C22 66 8 48 8 31C8 17 19 8 31 8C41 8 47 14 50 21C53 14 59 8 69 8C81 8 92 17 92 31C92 48 78 66 50 90Z",
  D: "M50 3C62 22 76 38 84 50C76 62 62 78 50 97C38 78 24 62 16 50C24 38 38 22 50 3Z",
  S: "M50 4C60 22 90 40 90 62C90 76 79 84 67 81C63 80 59 77 56 73C57 83 60 90 68 96H32C40 90 43 83 44 73C41 77 37 80 33 81C21 84 10 76 10 62C10 40 40 22 50 4Z",
  C: "M50 6A19 19 0 0 1 61 41A19 19 0 1 1 55 62C55 76 58 88 66 96H34C42 88 45 76 45 62A19 19 0 1 1 39 41A19 19 0 0 1 50 6Z",
};

/** A suit in its own colour (red suits red, black suits black), centred on (x, y) and `size` units wide. */
function Glyph({ suit, x, y, size, flip }: { suit: Suit; x: number; y: number; size: number; flip?: boolean }) {
  const k = size / 100;
  return (
    <g transform={`translate(${x} ${y}) rotate(${flip ? 180 : 0}) scale(${k}) translate(-50 -50)`}>
      <path d={SUIT_PATH[suit]} fill={isRed(suit) ? RED : INK} />
    </g>
  );
}

// Pip positions (card is 100 × 140): left column, right column, centre column.
const L = 33;
const R = 67;
const C = 50;
const PIPS: Record<number, [number, number][]> = {
  2: [[C, 38], [C, 102]],
  3: [[C, 38], [C, 70], [C, 102]],
  4: [[L, 38], [L, 102], [R, 38], [R, 102]],
  5: [[L, 38], [L, 102], [R, 38], [R, 102], [C, 70]],
  6: [[L, 38], [L, 70], [L, 102], [R, 38], [R, 70], [R, 102]],
  7: [[L, 38], [L, 70], [L, 102], [R, 38], [R, 70], [R, 102], [C, 54]],
  8: [[L, 38], [L, 70], [L, 102], [R, 38], [R, 70], [R, 102], [C, 54], [C, 86]],
  9: [[L, 34], [L, 57], [L, 83], [L, 106], [R, 34], [R, 57], [R, 83], [R, 106], [C, 70]],
  10: [[L, 34], [L, 57], [L, 83], [L, 106], [R, 34], [R, 57], [R, 83], [R, 106], [C, 45.500], [C, 94.500]],
};

const SERIF = 'ui-serif, "Iowan Old Style", "Palatino Linotype", Georgia, "Times New Roman", serif';

/** The printed face of a normal card, drawn in red suits and numerals in red, black ones in black, on cream paper. */
export function CardFace({ card }: { card: NormalCard }) {
  const label = rankLabel(card.rank);
  const ink = isRed(card.suit) ? RED : INK;
  const court = card.rank >= 11 && card.rank <= 13;
  const corner = (flip: boolean) => (
    <g transform={flip ? "rotate(180 50 70)" : undefined}>
      <text x="12" y="23" textAnchor="middle" fontSize={label.length > 1 ? 19 : 23} fontWeight="700" fill={ink} fontFamily={SERIF}>
        {label}
      </text>
      <Glyph suit={card.suit} x={12} y={36} size={13} />
    </g>
  );

  return (
    <svg viewBox="0 0 100 140" className="face" aria-hidden>
      {corner(false)}
      {corner(true)}
      {card.rank === 14 && <Glyph suit={card.suit} x={50} y={70} size={52} />}
      {court && (
        <g>
          <Glyph suit={card.suit} x={50} y={31} size={20} />
          <text x="50" y="88" textAnchor="middle" fontSize="54" fontWeight="700" fontFamily={SERIF} fill={ink}>
            {label}
          </text>
          <Glyph suit={card.suit} x={50} y={117} size={20} flip />
        </g>
      )}
      {PIPS[card.rank]?.map(([x, y], i) => (
        <Glyph key={i} suit={card.suit} x={x} y={y} size={20} flip={y > 70} />
      ))}
    </svg>
  );
}
