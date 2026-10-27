"use client";

import { useId } from "react";
import type { Rank } from "@/lib/ranks";

const SHIELD = "M32 3 L58 12 V36 C58 54 46 66 32 73 C18 66 6 54 6 36 V12 Z";
const SHIELD_INNER = "M32 9 L52 16 V36 C52 50 43 60 32 66 C21 60 12 50 12 36 V16 Z";
const STAR = "m32 22 4.3 9.1 10 1.2-7.4 6.9 2 9.9-8.9-5-8.9 5 2-9.9-7.4-6.9 10-1.2z";

/** A shield in the metal of the rank, with chevrons, a gem, a crown or (Joker) a star. */
export function RankEmblem({
  rank,
  className = "size-16",
  glow = true,
}: {
  rank: Rank;
  className?: string;
  glow?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const [light, dark] = rank.metal;
  const joker = !!rank.star;
  return (
    <svg
      viewBox="0 0 64 78"
      className={className}
      role="img"
      aria-label={rank.name}
      style={glow ? { filter: `drop-shadow(0 4px 12px ${rank.accent}66)` } : undefined}
    >
      <defs>
        <linearGradient id={`m${id}`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="0.55" stopColor={light} stopOpacity="0.55" />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={dark} stopOpacity="0.9" />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`c${id}`}>
          <path d={SHIELD} />
        </clipPath>
        {joker && (
          <linearGradient id={`j${id}`} gradientUnits="userSpaceOnUse" x1="-64" y1="0" x2="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              from="0 0"
              to="128 0"
              dur="2.8s"
              repeatCount="indefinite"
            />
          </linearGradient>
        )}
      </defs>

      {/* outer rim and face */}
      <path d={SHIELD} fill={`url(#m${id})`} stroke={dark} strokeWidth="1.4" strokeLinejoin="round" />
      <path d={SHIELD_INNER} fill={`url(#b${id})`} opacity="0.85" />
      <path d={SHIELD_INNER} fill="none" stroke={light} strokeOpacity="0.55" strokeWidth="1" />
      <g clipPath={`url(#c${id})`}>
        <rect x="0" y="0" width="64" height="78" fill={`url(#s${id})`} />
        {joker && <rect x="0" y="0" width="64" height="78" fill={`url(#j${id})`} />}
      </g>

      {/* centre piece */}
      {rank.star && (
        <path d={STAR} fill="#ffe9a3" stroke="#7a4bd6" strokeWidth="1.2" strokeLinejoin="round" />
      )}
      {rank.gem && (
        <g>
          <path d="M32 24 L44 36 L32 52 L20 36 Z" fill={rank.gem} stroke="#fff" strokeOpacity="0.85" strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M20 36 H44 M32 24 L26 36 L32 52 L38 36 Z" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.9" strokeLinejoin="round" />
        </g>
      )}
      {rank.crown && (
        <g>
          <path d="M18 46 L16 28 L25 36 L32 24 L39 36 L48 28 L46 46 Z" fill="#ffe29a" stroke="#5b3a06" strokeWidth="1.2" strokeLinejoin="round" />
          <rect x="18" y="46" width="28" height="5" rx="1.5" fill="#ffc83d" stroke="#5b3a06" strokeWidth="1" />
          <circle cx="32" cy="24" r="2" fill="#fff" />
          <circle cx="16" cy="28" r="1.6" fill="#fff" />
          <circle cx="48" cy="28" r="1.6" fill="#fff" />
        </g>
      )}
      {Array.from({ length: rank.chevrons }, (_, i) => {
        const y = 52 - i * 9 - (rank.chevrons === 1 ? 6 : 0);
        return (
          <path
            key={i}
            d={`M20 ${y - 7} L32 ${y} L44 ${y - 7}`}
            fill="none"
            stroke="#fff"
            strokeOpacity="0.92"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}
