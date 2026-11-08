"use client";

import { motionOff } from "@/lib/motion";
import { useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/joker/cards";
import { useT } from "@/lib/i18n";
import { Card3D } from "./Card3D";
import { CardView } from "./CardView";

const SHOWN: Card = { joker: false, suit: "H", rank: 13, id: "H13" };
const JOKER: Card = { joker: true, id: "J0" };
const ROW: Card[] = [
  { joker: false, suit: "S", rank: 14, id: "S14" },
  { joker: false, suit: "D", rank: 12, id: "D12" },
  { joker: false, suit: "C", rank: 11, id: "C11" },
  { joker: false, suit: "H", rank: 10, id: "H10" },
  { joker: false, suit: "S", rank: 7, id: "S7" },
];

/**
 * A deck in 3D: one big card that turns by dragging (and slowly by itself until it is touched),
 * with a button to flip it and a row of other faces below. `actions` are the shop's buy / equip button.
 */
export function DeckViewer({
  skin,
  jokerSkin,
  name,
  accent,
  actions,
  onClose,
}: {
  skin: string | null;
  /** Shows the joker with this look instead of a deck (`skin` is then the card back on its other side). */
  jokerSkin?: string;
  name: string;
  accent?: string;
  actions?: React.ReactNode;
  onClose: () => void;
}) {
  const t = useT();
  const [angle, setAngle] = useState({ x: -8, y: -28 });
  const [smooth, setSmooth] = useState(true);
  const [spinning, setSpinning] = useState(true);
  const auto = useRef(true);
  const stopSpin = () => {
    auto.current = false;
    setSpinning(false);
  };
  const drag = useRef<{ x: number; y: number; ax: number; ay: number } | null>(null);

  // it turns slowly by itself until somebody takes hold of it
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const spin = (now: number) => {
      const dt = now - last;
      last = now;
      if (auto.current) setAngle((a) => ({ x: a.x, y: a.y + dt * 0.03 }));
      raf = requestAnimationFrame(spin);
    };
    if (!motionOff()) raf = requestAnimationFrame(spin);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const down = (e: React.PointerEvent) => {
    stopSpin();
    setSmooth(false);
    drag.current = { x: e.clientX, y: e.clientY, ax: angle.x, ay: angle.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setAngle({ x: Math.max(-60, Math.min(60, d.ax - (e.clientY - d.y) * 0.5)), y: d.ay + (e.clientX - d.x) * 0.6 });
  };
  const up = () => {
    drag.current = null;
    setSmooth(true);
  };
  const flip = () => {
    stopSpin();
    setSmooth(true);
    setAngle((a) => ({ x: 0, y: Math.round((a.y + 180) / 180) * 180 }));
  };

  const edge = accent ? `color-mix(in srgb, ${accent} 45%, #14110c)` : undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative flex w-full max-w-md flex-col items-center gap-5 rounded-[2rem] border border-white/15 bg-[var(--bg-b)] p-5 pt-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("დახურვა", "Close", "Закрыть")}
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/10 text-xl leading-none text-white/80 transition-colors hover:bg-white/20"
        >
          ×
        </button>
        <h3 className="text-2xl font-extrabold">{name}</h3>

        <div
          className="relative grid w-full cursor-grab touch-none place-items-center py-6 active:cursor-grabbing"
          style={{ perspective: "1100px" }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          {accent && <div className="pointer-events-none absolute size-56 rounded-full blur-3xl" style={{ background: `${accent}44` }} />}
          <div
            className="relative [transform-style:preserve-3d]"
            style={{
              transform: `rotateX(${angle.x}deg) rotateY(${angle.y}deg)`,
              transition: smooth && !spinning ? "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)" : "none",
            }}
          >
            <Card3D skin={skin} jokerSkin={jokerSkin} card={jokerSkin ? JOKER : SHOWN} width={jokerSkin ? "min(16rem, 62vw)" : "min(13rem, 52vw)"} thickness={9} edge={edge} gloss={Math.sin((angle.y * Math.PI) / 180)} />
          </div>
          <div className="pointer-events-none absolute bottom-1 h-5 w-40 rounded-[50%] bg-black/50 blur-lg" />
        </div>

        <div className="flex items-center gap-2 text-sm text-white/55">
          <span>{t("გადაატრიალეთ თითით ან მაუსით", "Drag to turn it", "Потяните, чтобы повернуть")}</span>
          <button
            type="button"
            onClick={flip}
            className="rounded-full border border-white/20 px-3 py-1 text-sm font-bold text-white/80 transition-colors hover:border-amber-300 hover:text-amber-300"
          >
            ⟲ {t("გადაბრუნება", "Flip", "Перевернуть")}
          </button>
        </div>

        {!jokerSkin && (
        <div className="flex justify-center -space-x-3">
          {ROW.map((c, i) => (
            <CardView key={c.id} card={c} skin={skin} style={{ "--cw": "3.4rem", rotate: `${(i - 2) * 4}deg` } as React.CSSProperties} />
          ))}
        </div>
        )}

        {actions && <div className="w-full max-w-xs">{actions}</div>}
      </div>
    </div>
  );
}
