import type { Card } from "@/lib/joker/cards";
import { CardView } from "./CardView";

/** Paper grain: fine noise laid over a face, so the card is not a flat picture. */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/** What lies on top of a face: grain, a bevelled edge, and a glare that slides with `gloss` (-1..1). */
function Surface({ gloss }: { gloss: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ borderRadius: "calc(var(--cw) * 0.11)" }}>
      <div className="absolute inset-0 opacity-40 mix-blend-multiply" style={{ backgroundImage: GRAIN, backgroundSize: "70px 70px" }} />
      <div
        className="absolute inset-0 mix-blend-soft-light"
        style={{
          background: "linear-gradient(115deg, transparent 35%, rgb(255 255 255 / 0.9) 50%, transparent 65%)",
          backgroundSize: "260% 100%",
          backgroundPosition: `${50 - gloss * 55}% 0`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          borderRadius: "inherit",
          boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.28), inset 0 3px 5px -2px rgb(255 255 255 / 0.35), inset 0 -4px 7px -3px rgb(0 0 0 / 0.35)",
        }}
      />
    </div>
  );
}

/**
 * A playing card with a body: a front, a back and a few thin slabs between them, so it has a visible edge
 * when it is turned. The parent decides how it is turned (transform on a wrapper) and where the light is (`gloss`).
 */
export function Card3D({
  skin,
  jokerSkin,
  card,
  width,
  edge = "#d9d2bd",
  thickness = 6,
  gloss = 0,
  flipped = false,
}: {
  skin?: string | null;
  /** The look of the joker, when the front is the joker. */
  jokerSkin?: string | null;
  /** The face that is shown on the front; the back is always the deck's back. */
  card: Card;
  width: string;
  edge?: string;
  thickness?: number;
  gloss?: number;
  /** Shows the back instead of the front. */
  flipped?: boolean;
}) {
  const cw = { "--cw": width } as React.CSSProperties;
  const slabs = Math.max(3, Math.round(thickness));
  const radius = "calc(var(--cw) * 0.11)";
  const face = "absolute inset-0 [backface-visibility:hidden]";
  return (
    <div className="relative aspect-[5/7] [transform-style:preserve-3d]" style={{ width, ...cw, transform: flipped ? "rotateY(180deg)" : undefined }}>
      {Array.from({ length: slabs }, (_, i) => (
        <div
          key={i}
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: edge,
            transform: `translateZ(${(i - (slabs - 1) / 2) * (thickness / slabs)}px)`,
          }}
        />
      ))}
      <div className={face} style={{ transform: `translateZ(${thickness / 2}px)` }}>
        <CardView card={card} skin={skin} jokerSkin={jokerSkin} style={cw} />
        <Surface gloss={gloss} />
      </div>
      <div className={face} style={{ transform: `rotateY(180deg) translateZ(${thickness / 2}px)` }}>
        <CardView skin={skin} style={cw} />
        <Surface gloss={-gloss} />
      </div>
    </div>
  );
}
