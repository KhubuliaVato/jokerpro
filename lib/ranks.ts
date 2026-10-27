/** The rank ladder: one rank per 50 rating points up to 400, then the Joker at 1000. */
export interface Rank {
  /** 0-based position in the ladder. */
  index: number;
  name: string;
  /** Rating needed to hold this rank. */
  min: number;
  /** Metal of the shield, light to dark. */
  metal: [string, string];
  /** Colour for text and progress bars. */
  accent: string;
  /** Chevrons under the emblem's centre (0 = none). */
  chevrons: number;
  /** Gem set in the shield. */
  gem?: string;
  crown?: boolean;
  star?: boolean;
}

export const RANKS: Rank[] = [
  { index: 0, name: "ბრინჯაო", min: 50, metal: ["#e9b184", "#8b4f27"], accent: "#d9915a", chevrons: 1 },
  { index: 1, name: "ვერცხლი", min: 100, metal: ["#f6f8fb", "#8f9aa8"], accent: "#cfd7e2", chevrons: 2 },
  { index: 2, name: "ოქრო", min: 150, metal: ["#ffe59a", "#c98d14"], accent: "#f3c34b", chevrons: 3 },
  { index: 3, name: "პლატინა", min: 200, metal: ["#e6f7fb", "#5fa6bd"], accent: "#8fd6ea", chevrons: 3 },
  { index: 4, name: "ზურმუხტი", min: 250, metal: ["#c5f3dc", "#1f8f63"], accent: "#34d399", chevrons: 0, gem: "#2cf0a0" },
  { index: 5, name: "ლალი", min: 300, metal: ["#ffc3c9", "#a3223a"], accent: "#fb607a", chevrons: 0, gem: "#ff4766" },
  { index: 6, name: "ალმასი", min: 350, metal: ["#d9f6ff", "#3d7fb8"], accent: "#7fdcff", chevrons: 0, gem: "#9eeeff" },
  { index: 7, name: "ოსტატი", min: 400, metal: ["#ffd76a", "#5b3a06"], accent: "#ffc83d", chevrons: 0, crown: true },
  { index: 8, name: "ჯოკერი", min: 1000, metal: ["#c58bff", "#3a1670"], accent: "#d6a8ff", chevrons: 0, star: true },
];

/** The rating every new player starts with. */
export const START_RATING = 50;

export interface RankStanding {
  rank: Rank;
  /** The next rank, or null at the top. */
  next: Rank | null;
  /** 0..1 progress from this rank's threshold to the next one. */
  progress: number;
  /** Points still needed for the next rank (0 at the top). */
  toNext: number;
}

/** Rank for a rating. Below 50 points a player is still Bronze, with an empty bar. */
export function rankFor(rating: number): RankStanding {
  let i = 0;
  while (i + 1 < RANKS.length && rating >= RANKS[i + 1].min) i++;
  const rank = RANKS[i];
  const next = RANKS[i + 1] ?? null;
  if (!next) return { rank, next: null, progress: 1, toNext: 0 };
  const span = next.min - rank.min;
  return {
    rank,
    next,
    progress: Math.min(1, Math.max(0, (rating - rank.min) / span)),
    toNext: Math.max(0, next.min - rating),
  };
}
