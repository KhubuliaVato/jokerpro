"use client";

import { useEffect, useRef, useState } from "react";
import { cosmetic, REACTIONS, THROWABLES } from "@/lib/cosmetics";

/** One effect on its way across the table: a reaction from somebody, or a thing thrown from one seat to another. */
export type ActiveFx =
  | { key: number; kind: "r"; id: string; who: string }
  | { key: number; kind: "t"; id: string; who: string; from: number | null; to: number | null };

/** The animated reactions and thrown things of the table chat, drawn over everything and never in the way of a click. */
export function FxLayer({ items, onDone }: { items: ActiveFx[]; onDone: (key: number) => void }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {items.map((x) => (x.kind === "r" ? <Reaction key={x.key} fx={x} onDone={() => onDone(x.key)} /> : <Flight key={x.key} fx={x} onDone={() => onDone(x.key)} />))}
    </div>
  );
}

function Reaction({ fx, onDone }: { fx: Extract<ActiveFx, { kind: "r" }>; onDone: () => void }) {
  const def = REACTIONS.find((r) => r.id === fx.id);
  useEffect(() => {
    const id = setTimeout(onDone, 3200);
    return () => clearTimeout(id);
  }, [onDone]);
  if (!def) return null;
  const n = 16;
  return (
    <div className="absolute left-1/2 top-[38%]">
      <div className={`rx-main rx-main-${def.motion}`} style={{ filter: `drop-shadow(0 0 28px ${def.accent})` }}>
        {def.main}
      </div>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + (i % 2) * 0.2;
        const d = 120 + ((i * 53) % 90);
        const x = ((i * 37) % 90) - 45;
        const style = {
          "--tx": `${Math.cos(a) * d}px`,
          "--ty": `${Math.sin(a) * d}px`,
          "--x": `${x}vw`,
          "--s": `${1.2 + ((i * 7) % 10) / 8}rem`,
          animationDelay: `${def.motion === "drop" ? 0.45 : (i % 6) * 0.1}s`,
        } as React.CSSProperties;
        return (
          <span key={i} className={`rx-bit rx-${def.motion === "drop" ? "burst" : def.motion}`} style={style}>
            {def.bits[i % def.bits.length]}
          </span>
        );
      })}
      <div className="rx-tag" style={{ borderColor: def.accent }}>
        <b>{fx.who}</b> · {cosmetic(def.id)?.name}
      </div>
    </div>
  );
}

function centerOf(seat: number | null): { x: number; y: number } | null {
  if (seat === null) return null;
  // the same seat can be drawn more than once (phone and wide layouts); take the one that is on screen
  const e = [...document.querySelectorAll(`[data-seat="${seat}"]`)].find((x) => x.getBoundingClientRect().width > 0);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function Flight({ fx, onDone }: { fx: Extract<ActiveFx, { kind: "t" }>; onDone: () => void }) {
  const def = THROWABLES.find((t) => t.id === fx.id);
  const ref = useRef<HTMLDivElement>(null);
  const [hit, setHit] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = centerOf(fx.from) ?? { x: window.innerWidth / 2, y: window.innerHeight + 40 };
    const to = centerOf(fx.to) ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const at = (p: { x: number; y: number }, extra: string) => `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) ${extra}`;
    const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 90 };
    const anim = el.animate(
      [
        { transform: at(from, "scale(.5) rotate(0deg)"), opacity: 1 },
        { transform: at(mid, "scale(1.4) rotate(360deg)"), opacity: 1, offset: 0.5 },
        { transform: at(to, "scale(1.1) rotate(720deg)"), opacity: 1 },
      ],
      { duration: 750, easing: "cubic-bezier(.3,.5,.6,1)", fill: "forwards" },
    );
    anim.onfinish = () => {
      setHit(to);
      const target = fx.to === null ? null : [...document.querySelectorAll(`[data-seat="${fx.to}"]`)].find((x) => x.getBoundingClientRect().width > 0);
      target?.animate(
        [{ translate: "0 0" }, { translate: "-6px 0" }, { translate: "6px 0" }, { translate: "-4px 0" }, { translate: "3px 0" }, { translate: "0 0" }],
        { duration: 380 },
      );
    };
    return () => anim.cancel();
  }, [fx.from, fx.to]);

  useEffect(() => {
    const id = setTimeout(onDone, 2600);
    return () => clearTimeout(id);
  }, [onDone]);

  if (!def) return null;
  // a small burst of bits where it lands: the item itself for the messy ones, a flower or a flake for the others
  const bit = def.splat.startsWith("#") ? def.main : def.splat;
  return (
    <>
      <div ref={ref} className="fixed left-0 top-0 text-3xl leading-none" style={{ display: hit ? "none" : undefined, opacity: 0 }}>
        {def.main}
      </div>
      {hit && (
        <div className="fixed" style={{ left: hit.x, top: hit.y }}>
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2 + 0.3;
            return (
              <span key={i} className="rx-bit rx-burst" style={{ "--tx": `${Math.cos(a) * 34}px`, "--ty": `${Math.sin(a) * 34}px`, "--s": "1rem" } as React.CSSProperties}>
                {bit}
              </span>
            );
          })}
          <span className="rx-splat-emoji">{def.main}</span>
        </div>
      )}
    </>
  );
}
