import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameState } from "@/lib/joker/engine";
import { totals } from "@/lib/joker/engine";
import { schedule } from "@/lib/joker/rules";
import { HUMAN } from "@/lib/joker/useGame";
import { placeOf, type GameResult } from "./stats";

export type { GameResult };

/** Saves a finished game; returns an error message or null. */
export async function saveJokerResult(
  supabase: SupabaseClient,
  userId: string,
  game: GameState,
): Promise<string | null> {
  const scores = totals(game);
  const { error } = await supabase.from("game_results").insert({
    user_id: userId,
    game: "joker",
    format: game.rules.format,
    hands: schedule(game.rules.format).flat().length,
    place: placeOf(scores, HUMAN),
    score: scores[HUMAN],
    scores,
  });
  return error ? error.message : null;
}

export async function loadResults(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ results: GameResult[]; error: string | null }> {
  const { data, error } = await supabase
    .from("game_results")
    .select("id, game, format, hands, place, score, scores, played_at, online, players")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(500);
  return { results: (data ?? []) as GameResult[], error: error ? error.message : null };
}
