import { tt } from "./lang";

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
  /** ranked / friendly (online games with random players). */
  kind?: "ranked" | "friendly" | null;
  /** Rating around a ranked game; the change is after - before. */
  rating_before?: number | null;
  rating_after?: number | null;
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
    { id: "first", icon: "★", title: tt("პირველი გამარჯვება", "First win", "Первая победа"), hint: tt("მოიგეთ ერთი თამაში", "Win a game", "Выиграйте одну игру"), done: stats.wins >= 1 },
    { id: "ten", icon: "♠", title: tt("10 თამაში", "10 games", "10 игр"), hint: tt("დაასრულეთ 10 თამაში", "Finish 10 games", "Завершите 10 игр"), done: stats.played >= 10 },
    { id: "score", icon: "♦", title: tt("500 ქულა", "500 points", "500 очков"), hint: tt("ერთ თამაშში 500+", "500+ in one game", "500+ за одну игру"), done: (stats.best ?? 0) >= 500 },
    { id: "streak", icon: "♥", title: tt("სამი ზედიზედ", "Three in a row", "Три подряд"), hint: tt("მოიგეთ სამი თამაში ზედიზედ", "Win three games in a row", "Выиграйте три игры подряд"), done: bestStreak(results) >= 3 },
    {
      id: "full",
      icon: "♛",
      title: tt("სრული თამაშის ოსტატი", "Full game master", "Мастер полной игры"),
      hint: tt("მოიგეთ სრული თამაში", "Win a full game", "Выиграйте полную игру"),
      done: results.some((r) => r.format === "full" && r.place === 1),
    },
  ];
}
