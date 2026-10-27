import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameResult } from "./stats";

export type { GameResult };

export async function loadResults(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ results: GameResult[]; error: string | null }> {
  const { data, error } = await supabase
    .from("game_results")
    .select("id, game, format, hands, place, score, scores, played_at, online, players, kind, rating_before, rating_after")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(500);
  return { results: (data ?? []) as GameResult[], error: error ? error.message : null };
}
