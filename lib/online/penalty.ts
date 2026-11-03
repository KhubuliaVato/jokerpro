/** What leaving a running game costs; shared by the game server and the screens. */

/** A player who left can take the seat back this long (ms). */
export const RETURN_WINDOW_MS = 7 * 60 * 1000;
/** The ban from new tables after leaving (ms), counted from the end of the return window. */
export const BAN_MS = 2 * 60 * 60 * 1000;

/** Rating penalty for leaving a ranked game: 10 right at the start, 6 at the very end. */
const PENALTY_EARLY = 10;
const PENALTY_LATE = 6;

/** What leaving at `progress` (0 = start, 1 = end of the game) costs. */
export function quitPenalty(progress: number): number {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  return Math.round(PENALTY_EARLY - (PENALTY_EARLY - PENALTY_LATE) * p);
}

/** Whoever took the seat back in time pays half of it. */
export const returnedPenalty = (progress: number) => Math.round(quitPenalty(progress) / 2);

/** How far into the game a seat was left: the game's version then against its version at the end. */
export function leftProgress(leftVersion: number | null, endVersion: number): number {
  if (leftVersion === null || endVersion <= 0) return 0;
  return Math.min(1, Math.max(0, leftVersion / endVersion));
}
