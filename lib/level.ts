import type { SupabaseClient } from "@supabase/supabase-js";

/** The last level. */
export const MAX_LEVEL = 100;

/** The levels that give a frame, and the frame (the look is `.avf-<id>` in globals.css). */
export const LEVEL_FRAMES = [
  { level: 25, id: "f_lv25", names: ["ბრინჯაოს ლეველი", "Bronze level", "Бронзовый уровень"] as [string, string, string], accent: "#d08a4c" },
  { level: 50, id: "f_lv50", names: ["ვერცხლის ლეველი", "Silver level", "Серебряный уровень"] as [string, string, string], accent: "#cbd5e1" },
  { level: 75, id: "f_lv75", names: ["ოქროს ლეველი", "Gold level", "Золотой уровень"] as [string, string, string], accent: "#fbbf24" },
  { level: 100, id: "f_lv100", names: ["ბრილიანტის ლეველი", "Diamond level", "Бриллиантовый уровень"] as [string, string, string], accent: "#67e8f9" },
] as const;

/** XP a player needs to reach a level (level 1 needs none). The database uses the same curve (`level_of`). */
export const xpAt = (level: number) => 6 * (level - 1) * (level + 10);

/** Level, and how far toward the next one, for an amount of XP. */
export function levelInfo(xp: number) {
  const x = Math.max(0, Math.floor(xp));
  let level = 1;
  while (level < MAX_LEVEL && xpAt(level + 1) <= x) level++;
  const from = xpAt(level);
  const to = level < MAX_LEVEL ? xpAt(level + 1) : from;
  return { level, xp: x, from, to, into: x - from, span: to - from, progress: level >= MAX_LEVEL ? 1 : (x - from) / (to - from), max: level >= MAX_LEVEL };
}

/** The colour of a level badge: it changes with every frame milestone. */
export function levelColor(level: number): string {
  if (level >= 100) return "#67e8f9";
  if (level >= 75) return "#fbbf24";
  if (level >= 50) return "#cbd5e1";
  if (level >= 25) return "#d08a4c";
  return "#94a3b8";
}

/** A player's XP (0 for a player who has not finished a game, or for a database without levels). */
export async function loadXp(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data } = await supabase.from("player_xp").select("xp").eq("user_id", userId).maybeSingle();
  return (data?.xp as number | undefined) ?? 0;
}
