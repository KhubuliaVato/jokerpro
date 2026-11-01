"use client";

import { useId } from "react";
import type { Rank } from "@/lib/ranks";

const SHIELD = "M32 3 L58 12 V36 C58 54 46 66 32 73 C18 66 6 54 6 36 V12 Z";
const SHIELD_INNER = "M32 9 L52 16 V36 C52 50 43 60 32 66 C21 60 12 50 12 36 V16 Z";

/**
 * Curved horns that sweep up from the shield's sides, like folded wings (the left ones; the right ones are mirrored).
 * `edge` is the lit outer edge of each horn, `rib` the line along its middle. Higher ranks carry more of them.
 */
const BLADES = [
  { d: "M7 24 C2 21 -3 14 -6.5 4 C-8 20 -3 35 8 41 Z", edge: "M7 24 C2 21 -3 14 -6.5 4", rib: "M7 31 C1 27 -3 19 -5 10" },
  { d: "M9 44 C4 42 0 37 -2.5 29 C-3.5 42 2 52 11 56 Z", edge: "M9 44 C4 42 0 37 -2.5 29", rib: "M9 50 C4 46 1 41 -1 36" },
  { d: "M11 58 C7 57 4 54 2.5 49 C2 57 6 63 12 65 Z", edge: "M11 58 C7 57 4 54 2.5 49", rib: "" },
];

/** How the ladder grows: how many horns, whether there is a crest, how long the pendant is, and the dark face of the shield. */
const TIERS: { blades: number; crest: boolean; pendant: number; face: [string, string, string]; sparkles: boolean }[] = [
  { blades: 0, crest: false, pendant: 79, face: ["#2c1b12", "#150c07", "#080403"], sparkles: false },
  { blades: 0, crest: false, pendant: 81, face: ["#262c37", "#12151c", "#07080b"], sparkles: false },
  { blades: 0, crest: true, pendant: 84, face: ["#322a12", "#18130a", "#090703"], sparkles: false },
  { blades: 1, crest: true, pendant: 86, face: ["#17313a", "#0b1a20", "#04090b"], sparkles: false },
  { blades: 2, crest: true, pendant: 89, face: ["#123428", "#091b15", "#030b08"], sparkles: true },
  { blades: 2, crest: true, pendant: 91, face: ["#3a131c", "#1b0a0f", "#0a0306"], sparkles: true },
  { blades: 3, crest: true, pendant: 93, face: ["#143050", "#0a1a2d", "#040b14"], sparkles: true },
  { blades: 3, crest: true, pendant: 94, face: ["#352808", "#1a1304", "#0a0701"], sparkles: true },
  { blades: 3, crest: true, pendant: 95, face: ["#2e2350", "#120c26", "#07050f"], sparkles: true },
];

/** A four-point sparkle. */
const sparkle = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r} Z`;

/** An eight-point compass star: four long points and four short ones. */
function burst(cx: number, cy: number, long: number, short: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i - Math.PI / 2;
    const d = i % 2 === 0 ? long : short;
    pts.push(`${(cx + Math.cos(a) * d).toFixed(2)} ${(cy + Math.sin(a) * d).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
}

interface EmblemProps {
  rank: Rank;
  className?: string;
  glow?: boolean;
  compact?: boolean;
  progress?: number;
}

/**
 * The emblem of a rank. Every rank is an obsidian shield framed in a thin metal of its own, with a lattice of
 * hairlines, a pendant point and a centre piece; the higher the rank, the more horns, jewels and glints it carries.
 * `compact` is the plain version for tiny sizes; `progress` (0..1) draws a ring round the shield that fills toward the next rank.
 */
export function RankEmblem(props: EmblemProps) {
  return props.compact ? <CompactEmblem {...props} /> : <EliteEmblem {...props} />;
}

/** The plain version for tiny sizes: the same obsidian shield in thin metal, with one bold mark and no fine detail. */
function CompactEmblem({ rank, className = "size-16", glow = true }: EmblemProps) {
  const id = useId().replace(/:/g, "");
  const tier = TIERS[Math.min(rank.index, TIERS.length - 1)];
  const grand = !!rank.star;
  const [metalLight, metalDark] = rank.metal;
  const hi = grand ? "#fff6d2" : metalLight;
  const mid = grand ? "#e9c25e" : rank.accent;
  const lo = grand ? "#5c3d0a" : metalDark;
  return (
    <svg
      viewBox="0 0 64 84"
      className={className}
      role="img"
      aria-label={rank.name}
      style={glow ? { filter: `drop-shadow(0 4px 12px ${rank.accent}66)` } : undefined}
    >
      <defs>
        <linearGradient id={`g${id}`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={hi} />
          <stop offset="0.4" stopColor={mid} />
          <stop offset="1" stopColor={lo} />
        </linearGradient>
        <linearGradient id={`v${id}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={tier.face[0]} />
          <stop offset="1" stopColor={tier.face[2]} />
        </linearGradient>
      </defs>
      {/* a short pendant under the shield */}
      <path d="M32 68 L37 76 L32 83 L27 76 Z" fill={`url(#g${id})`} />
      <path d={SHIELD} fill={`url(#v${id})`} stroke={`url(#g${id})`} strokeWidth="4.2" strokeLinejoin="round" />
      {/* tinted with the metal so the dark face does not vanish on a dark background */}
      <path d={SHIELD} fill={mid} fillOpacity="0.26" />
      {grand && <path d={burst(32, 38, 20, 7.5)} fill={`url(#g${id})`} strokeLinejoin="round" />}
      {rank.crown && (
        <>
          <path d="M17 49 L14 28 L25 37 L32 22 L39 37 L50 28 L47 49 Z" fill={`url(#g${id})`} strokeLinejoin="round" />
          <rect x="17" y="49" width="30" height="6" rx="1.5" fill={`url(#g${id})`} />
        </>
      )}
      {rank.gem && (
        <path d="M32 21 L47 37 L32 57 L17 37 Z" fill={rank.gem} stroke={hi} strokeWidth="2" strokeLinejoin="round" />
      )}
      {!grand && !rank.crown && !rank.gem && (
        <>
          {Array.from({ length: Math.max(1, Math.min(rank.chevrons, 2)) }, (_, i) => (
            <path
              key={i}
              d={`M19 ${(Math.min(rank.chevrons, 2) > 1 ? 31 : 36) + i * 12} L32 ${(Math.min(rank.chevrons, 2) > 1 ? 41 : 46) + i * 12} L45 ${(Math.min(rank.chevrons, 2) > 1 ? 31 : 36) + i * 12}`}
              fill="none"
              stroke={`url(#g${id})`}
              strokeWidth="6.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </>
      )}
    </svg>
  );
}

function EliteEmblem({ rank, className = "size-16", glow = true, progress }: EmblemProps) {
  const id = useId().replace(/:/g, "");
  const idx = rank.index;
  const tier = TIERS[Math.min(idx, TIERS.length - 1)];
  const grand = !!rank.star;
  const master = !!rank.crown;
  const ring = progress !== undefined;
  const ringLength = 100;

  // the metal of the frame: gold for the GrandMaster, the rank's own metal for the others
  const [metalLight, metalDark] = rank.metal;
  const hi = grand ? "#fff6d2" : metalLight;
  const mid = grand ? "#e9c25e" : rank.accent;
  const lo = grand ? "#5c3d0a" : metalDark;
  const edge = "#000";
  const pendantEnd = tier.pendant;

  return (
    <svg
      viewBox={ring ? "-14 -11 92 109" : "-7 -10 78 106"}
      className={className}
      role="img"
      aria-label={rank.name}
      style={glow ? { filter: `drop-shadow(0 6px 16px ${rank.accent}55)` } : undefined}
    >
      <defs>
        <linearGradient id={`g${id}`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={hi} />
          <stop offset="0.3" stopColor={mid} />
          <stop offset="0.7" stopColor={grand ? "#a87a22" : mid} stopOpacity={grand ? 1 : 0.75} />
          <stop offset="1" stopColor={lo} />
        </linearGradient>
        <linearGradient id={`w${id}`} gradientUnits="userSpaceOnUse" x1="-8" y1="6" x2="10" y2="46">
          <stop offset="0" stopColor={hi} />
          <stop offset="0.45" stopColor={mid} />
          <stop offset="1" stopColor={lo} />
        </linearGradient>
        <linearGradient id={`v${id}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={tier.face[0]} />
          <stop offset="0.55" stopColor={tier.face[1]} />
          <stop offset="1" stopColor={tier.face[2]} />
        </linearGradient>
        <linearGradient id={`t${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`h${id}`}>
          <stop offset="0" stopColor={rank.accent} stopOpacity={grand ? 0.4 : 0.3} />
          <stop offset="1" stopColor={rank.accent} stopOpacity="0" />
        </radialGradient>
        <pattern id={`p${id}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0 H7 M0 0 V7" stroke={mid} strokeOpacity="0.14" strokeWidth="0.5" />
        </pattern>
        <clipPath id={`c${id}`}>
          <path d={SHIELD} />
        </clipPath>
        {(grand || master) && (
          <linearGradient id={`j${id}`} gradientUnits="userSpaceOnUse" x1="-48" y1="0" x2="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor={hi} stopOpacity="0.35" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
            <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="120 0" dur={grand ? "5s" : "6s"} repeatCount="indefinite" />
          </linearGradient>
        )}
      </defs>

      {ring && (
        <g transform="rotate(-90 32 39)">
          <circle cx="32" cy="39" r="43" fill="none" stroke="#fff" strokeOpacity="0.12" strokeWidth="2.4" />
          <circle
            cx="32"
            cy="39"
            r="43"
            fill="none"
            stroke={mid}
            strokeWidth="2.4"
            strokeLinecap="round"
            pathLength={ringLength}
            strokeDasharray={`${Math.max(0.5, (progress ?? 0) * ringLength)} ${ringLength}`}
          />
        </g>
      )}

      {idx >= 2 && <circle cx="32" cy="38" r="44" fill={`url(#h${id})`} />}

      {/* horns behind the shield */}
      {tier.blades > 0 &&
        [false, true].map((mirror) => (
          <g key={String(mirror)} transform={mirror ? "translate(64 0) scale(-1 1)" : undefined} strokeLinejoin="round" strokeLinecap="round">
            {BLADES.slice(0, tier.blades).map((b, i) => (
              <g key={i}>
                <path d={b.d} fill={`url(#w${id})`} stroke={edge} strokeOpacity="0.6" strokeWidth="0.6" />
                {b.rib && <path d={b.rib} fill="none" stroke={edge} strokeOpacity="0.45" strokeWidth="0.7" />}
                <path d={b.edge} fill="none" stroke={hi} strokeWidth="0.9" />
              </g>
            ))}
          </g>
        ))}

      {/* a pendant point hangs below the shield; the higher the rank, the longer it is */}
      <g strokeLinejoin="round" strokeLinecap="round">
        <path d={`M32 68 L${idx >= 4 ? 37.5 : 36} 76 L32 ${pendantEnd} L${idx >= 4 ? 26.5 : 28} 76 Z`} fill={`url(#g${id})`} stroke={edge} strokeOpacity="0.6" strokeWidth="0.6" />
        <path d={`M32 71 V${pendantEnd - 5}`} fill="none" stroke={hi} strokeOpacity="0.7" strokeWidth="0.7" />
        {idx >= 4 &&
          [false, true].map((mirror) => (
            <g key={String(mirror)} transform={mirror ? "translate(64 0) scale(-1 1)" : undefined} fill="none" stroke={`url(#g${id})`} strokeWidth="1.1">
              <path d="M13 62 C17 72 23 77 29 78" />
              {idx >= 7 && <path d="M19 66 C22 72 26 75 29 75.5" strokeWidth="0.7" strokeOpacity="0.7" />}
            </g>
          ))}
      </g>

      {/* the shield: obsidian, framed in thin metal */}
      <path d={SHIELD} fill={`url(#v${id})`} stroke={`url(#g${id})`} strokeWidth="2.2" strokeLinejoin="round" />
      <path d={SHIELD_INNER} fill="none" stroke={mid} strokeOpacity="0.55" strokeWidth="0.6" />
      <g clipPath={`url(#c${id})`}>
        <rect x="0" y="0" width="64" height="78" fill={`url(#p${id})`} />
        <rect x="0" y="0" width="64" height="78" fill={`url(#t${id})`} />
        {(grand || master) && <rect className="motion-reduce:hidden" x="0" y="0" width="64" height="78" fill={`url(#j${id})`} />}
      </g>

      {/* the centre piece */}
      <circle cx="32" cy="38" r="13.5" fill="none" stroke={mid} strokeOpacity="0.4" strokeWidth="0.7" />
      <Centre rank={rank} id={id} hi={hi} mid={mid} />

      {/* crest and base jewels */}
      {tier.crest && (
        <>
          <path d="M32 -7 L35.6 -0.6 L32 5 L28.4 -0.6 Z" fill={`url(#g${id})`} stroke={edge} strokeOpacity="0.6" strokeWidth="0.6" strokeLinejoin="round" />
          <path d="M32 -3.6 L33.6 -0.6 L32 2 L30.4 -0.6 Z" fill={rank.gem ?? (grand ? "#a98bff" : hi)} />
        </>
      )}
      <path d="M32 61 L34 64 L32 67 L30 64 Z" fill={`url(#g${id})`} />

      {tier.sparkles && (
        <g className="motion-reduce:hidden" fill={hi}>
          {[
            [44, 25, 2.6, "0s"],
            [20, 52, 2, "1.6s"],
          ].map(([x, y, r, begin]) => (
            <path key={`${x}${y}`} d={sparkle(x as number, y as number, r as number)} opacity="0">
              <animate attributeName="opacity" values="0;1;0" dur="3.2s" begin={begin as string} repeatCount="indefinite" />
            </path>
          ))}
        </g>
      )}
    </svg>
  );
}

/** What sits in the middle of the shield: chevrons for the first ranks, a cut stone for the gems, a crown, a star. */
function Centre({ rank, id, hi, mid }: { rank: Rank; id: string; hi: string; mid: string }) {
  const dark = "#000";
  if (rank.star) {
    return (
      <>
        <path d={burst(32, 38, 17, 6.4)} fill={`url(#g${id})`} stroke={hi} strokeOpacity="0.5" strokeWidth="0.5" strokeLinejoin="round" />
        <path d={burst(32, 38, 9, 3.4)} fill="#120c26" fillOpacity="0.7" />
        <circle cx="32" cy="38" r="1.7" fill={hi} />
      </>
    );
  }
  if (rank.crown) {
    return (
      <g strokeLinejoin="round">
        <path d="M20 46 L18 30 L26 37 L32 26 L38 37 L46 30 L44 46 Z" fill={`url(#g${id})`} stroke={dark} strokeOpacity="0.55" strokeWidth="0.7" />
        <path d="M20 46 H44 V50.5 H20 Z" fill={`url(#g${id})`} stroke={dark} strokeOpacity="0.55" strokeWidth="0.7" />
        <circle cx="32" cy="26" r="1.7" fill={hi} />
        <circle cx="18" cy="30" r="1.4" fill={hi} />
        <circle cx="46" cy="30" r="1.4" fill={hi} />
        <path d="M32 40 L34 43 L32 46 L30 43 Z" fill={hi} fillOpacity="0.85" />
      </g>
    );
  }
  if (rank.gem) {
    const gem = rank.gem;
    const cut =
      rank.index === 4
        ? { body: "M32 23 L42 30 V45 L32 53 L22 45 V30 Z", facets: "M22 30 H42 M22 45 H42 M32 23 V53 M22 30 L32 38 L42 30 M22 45 L32 38 L42 45" }
        : rank.index === 5
          ? { body: "M32 23 L45 36 L32 53 L19 36 Z", facets: "M19 36 H45 M32 23 L26 36 L32 53 L38 36 Z" }
          : { body: "M24 26 H40 L47 35 L32 54 L17 35 Z", facets: "M17 35 H47 M24 26 L28 35 L32 54 L36 35 L40 26 M28 35 L32 26 L36 35" };
    return (
      <g strokeLinejoin="round">
        <path d={cut.body} fill={gem} stroke={hi} strokeOpacity="0.85" strokeWidth="1" />
        <path d={cut.facets} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.7" />
        <path d={cut.body} fill={`url(#t${id})`} />
        <path d={sparkle(41, 27, 3.4)} fill="#fff" opacity="0.85" />
      </g>
    );
  }
  // chevrons, one to three of them, drawn with a dark edge so they sit on the shield
  const n = Math.max(1, rank.chevrons);
  const top = 38 - ((n - 1) * 8) / 2 + 3;
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {Array.from({ length: n }, (_, i) => {
        const y = top + i * 8;
        const d = `M23 ${y - 6} L32 ${y + 1} L41 ${y - 6}`;
        return (
          <g key={i}>
            <path d={d} stroke="#000" strokeOpacity="0.5" strokeWidth="4.2" transform="translate(0 1.2)" />
            <path d={d} stroke={`url(#g${id})`} strokeWidth="3" />
            <path d={d} stroke={hi} strokeOpacity="0.7" strokeWidth="0.8" transform="translate(0 -0.7)" />
          </g>
        );
      })}
      {rank.index === 3 && <path d="M32 21.5 L34 25 L32 28.5 L30 25 Z" fill={mid} stroke={hi} strokeWidth="0.5" />}
    </g>
  );
}
