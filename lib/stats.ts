export interface GameResult {
  id: string;
  game: string;
  format: "full" | "nine";
  hands: number;
  place: number;
  score: number;
  scores: number[];
  played_at: string;
  /** Played at an online table (then `players` holds the four nicknames, the player first). */
  online?: boolean;
  players?: string[] | null;
}

export interface Stats {
  played: number;
  wins: number;
  /** Wins as a share of games played, 0..100. */
  winRate: number;
  best: number | null;
  /** Average finishing place, 1..4. */
  avgPlace: number | null;
}

/** Finishing place of seat `me`: 1 + the number of seats with a strictly higher score. */
export function placeOf(scores: number[], me = 0): number {
  return 1 + scores.filter((s) => s > scores[me]).length;
}

export function computeStats(results: Pick<GameResult, "place" | "score">[]): Stats {
  const played = results.length;
  if (played === 0) return { played: 0, wins: 0, winRate: 0, best: null, avgPlace: null };
  const wins = results.filter((r) => r.place === 1).length;
  return {
    played,
    wins,
    winRate: Math.round((wins / played) * 100),
    best: Math.max(...results.map((r) => r.score)),
    avgPlace: results.reduce((a, r) => a + r.place, 0) / played,
  };
}

/** How many games ended in each place: index 0 is 1st place, index 3 is 4th. */
export function placeCounts(results: Pick<GameResult, "place">[]): [number, number, number, number] {
  const counts: [number, number, number, number] = [0, 0, 0, 0];
  for (const r of results) if (r.place >= 1 && r.place <= 4) counts[r.place - 1] += 1;
  return counts;
}

/** Longest run of consecutive wins. `results` is newest first, as loaded. */
export function bestStreak(results: Pick<GameResult, "place">[]): number {
  let best = 0;
  let run = 0;
  for (const r of [...results].reverse()) {
    run = r.place === 1 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export interface Rank {
  name: string;
  icon: string;
  /** Games needed to reach this rank. */
  min: number;
}

export const RANKS: Rank[] = [
  { name: "დამწყები", icon: "♠", min: 0 },
  { name: "მოთამაშე", icon: "♥", min: 5 },
  { name: "გამოცდილი", icon: "♣", min: 20 },
  { name: "ოსტატი", icon: "♦", min: 50 },
  { name: "ლეგენდა", icon: "♛", min: 100 },
];

/** Current rank plus progress (0..1) towards the next one; `next` is null at the top. */
export function rankFor(played: number): { rank: Rank; next: Rank | null; progress: number } {
  let i = 0;
  while (i + 1 < RANKS.length && played >= RANKS[i + 1].min) i++;
  const rank = RANKS[i];
  const next = RANKS[i + 1] ?? null;
  const progress = next ? (played - rank.min) / (next.min - rank.min) : 1;
  return { rank, next, progress };
}

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  hint: string;
  done: boolean;
}

export function achievements(results: Pick<GameResult, "place" | "score" | "format">[]): Achievement[] {
  const stats = computeStats(results);
  return [
    { id: "first", icon: "★", title: "პირველი გამარჯვება", hint: "მოიგეთ ერთი თამაში", done: stats.wins >= 1 },
    { id: "ten", icon: "♠", title: "10 თამაში", hint: "დაასრულეთ 10 თამაში", done: stats.played >= 10 },
    { id: "score", icon: "♦", title: "500 ქულა", hint: "ერთ თამაშში 500+", done: (stats.best ?? 0) >= 500 },
    { id: "streak", icon: "♥", title: "სამი ზედიზედ", hint: "მოიგეთ სამი თამაში ზედიზედ", done: bestStreak(results) >= 3 },
    {
      id: "full",
      icon: "♛",
      title: "სრული თამაშის ოსტატი",
      hint: "მოიგეთ სრული თამაში",
      done: results.some((r) => r.format === "full" && r.place === 1),
    },
  ];
}
