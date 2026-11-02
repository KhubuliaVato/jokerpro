import type { Card } from "@/lib/joker/cards";
import { Card3D } from "./Card3D";

const FACE: Card = { joker: false, suit: "H", rank: 13, id: "H13" };

/**
 * A deck as the shop and the inventory show it: two real (thick) cards in perspective, swaying a little.
 * They cannot be turned by hand here; the viewer opens for that.
 */
export function BackPreview({ skin, accent, width = "5.2rem" }: { skin?: string | null; accent?: string; width?: string }) {
  const edge = accent ? `color-mix(in srgb, ${accent} 45%, #14110c)` : undefined;
  // the two cards lie at different depths and hardly overlap, so they never pass through each other while they sway
  const one = (side: "back" | "front") => (
    <div
      className="absolute top-1/2 [transform-style:preserve-3d]"
      style={{
        left: side === "back" ? "2%" : "40%",
        marginTop: `calc(${width} * -0.7)`,
        transform: `translateZ(${side === "back" ? -35 : 35}px)`,
      }}
    >
      <div
        className="deck-sway [transform-style:preserve-3d] group-hover:[animation-duration:2.4s]"
        style={
          {
            "--rz": side === "back" ? "-8deg" : "6deg",
            "--ry": side === "back" ? "-14deg" : "12deg",
            animationDelay: side === "back" ? "-1.5s" : "0s",
          } as React.CSSProperties
        }
      >
        <Card3D skin={skin} card={FACE} width={width} edge={edge} thickness={5} gloss={side === "back" ? -0.4 : 0.4} flipped={side === "back"} />
      </div>
    </div>
  );
  return (
    <div className="relative" style={{ width: `calc(${width} * 1.7)`, height: `calc(${width} * 1.55)`, perspective: "650px", transformStyle: "preserve-3d" }}>
      {accent && <div className="absolute inset-4 rounded-full blur-2xl" style={{ background: `${accent}55` }} />}
      {one("back")}
      {one("front")}
    </div>
  );
}
