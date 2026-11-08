"use client";

import { useEffect, useState } from "react";
import { cosmetic, REACTIONS, THROWABLES } from "@/lib/cosmetics";
import { previewSoundPack } from "@/lib/sound";
import { CardView } from "./CardView";

const KING = { joker: false, suit: "H", rank: 13, id: "H13" } as const;

/** A reaction or a throwable: its picture, glowing in its colour and bouncing a little. */
export function EmojiArt({ id, size = "text-5xl" }: { id: string; size?: string }) {
  const def = REACTIONS.find((r) => r.id === id) ?? THROWABLES.find((t) => t.id === id);
  if (!def) return null;
  return (
    <span className={`inline-block animate-bounce leading-none ${size}`} style={{ filter: `drop-shadow(0 0 14px ${def.accent})`, animationDuration: "1.8s" }}>
      {def.main}
    </span>
  );
}

/** A card that lands again and again, so the effect of a play-effect item can be seen. */
export function PlayFxArt({ id, width = "2.2rem" }: { id: string; width?: string }) {
  const [round, setRound] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setRound((r) => r + 1), 2200);
    return () => clearInterval(t);
  }, []);
  // the effect is bigger than the card: a box of its own keeps it from running over the name and the button
  return (
    <div className="relative grid h-[6.6rem] w-[8.4rem] place-items-center overflow-hidden rounded-xl">
      <style>{"@keyframes deal-in-art{from{opacity:0;transform:translateY(-18px) scale(.8)}to{opacity:1;transform:none}}"}</style>
      <div key={round} className={`relative ${id ? `fxp-${id}` : ""}`} style={{ animation: "deal-in-art 0.34s cubic-bezier(0.2, 0.9, 0.3, 1) both", "--fxp-s": 1.08 } as React.CSSProperties}>
        <CardView card={KING} style={{ "--cw": width } as React.CSSProperties} />
      </div>
    </div>
  );
}

/** A sound pack: a play button that lets you hear it. */
export function SoundArt({ id }: { id: string }) {
  const accent = cosmetic(id)?.accent ?? "#94a3b8";
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        previewSoundPack(id);
      }}
      onKeyDown={(e) => e.key === "Enter" && previewSoundPack(id)}
      aria-label="▶"
      className="pointer-events-auto relative grid size-16 cursor-pointer place-items-center rounded-full text-2xl text-white transition-transform hover:scale-110 active:scale-95"
      style={{ background: `radial-gradient(circle at 30% 28%, ${accent}, ${accent}55 70%)`, boxShadow: `0 0 22px ${accent}66` }}
    >
      ▶
    </span>
  );
}
