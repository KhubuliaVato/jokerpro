import type { SupabaseClient } from "@supabase/supabase-js";

export interface RatingRow {
  rating: number;
  games: number;
  wins: number;
  peak: number;
}

export interface LeaderRow {
  pos: number;
  user_id: string;
  nickname: string;
  avatar_color: string;
  avatar_icon: string;
  avatar_url: string | null;
  rating: number;
  games: number;
  wins: number;
}

export async function loadRating(supabase: SupabaseClient, userId: string, game = "joker"): Promise<RatingRow | null> {
  const { data } = await supabase
    .from("player_ratings")
    .select("rating, games, wins, peak")
    .eq("user_id", userId)
    .eq("game", game)
    .maybeSingle();
  return (data as RatingRow | null) ?? null;
}

/** Ratings of several players at once (players who never played ranked are missing from the result). */
export async function loadRatings(
  supabase: SupabaseClient,
  userIds: string[],
  game = "joker",
): Promise<Record<string, RatingRow>> {
  if (userIds.length === 0) return {};
  const { data } = await supabase
    .from("player_ratings")
    .select("user_id, rating, games, wins, peak")
    .eq("game", game)
    .in("user_id", userIds);
  return Object.fromEntries(((data ?? []) as (RatingRow & { user_id: string })[]).map((r) => [r.user_id, r]));
}

export async function loadLeaderboard(
  supabase: SupabaseClient,
  game = "joker",
  limit = 100,
): Promise<{ rows: LeaderRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc("get_leaderboard", { p_game: game, p_limit: limit });
  const rows = ((data ?? []) as (Omit<LeaderRow, "pos"> & { pos: number | string })[]).map((r) => ({
    ...r,
    pos: Number(r.pos),
  }));
  return { rows, error: error ? error.message : null };
}

/** A player's place on the leaderboard (1 = best), or null if they have no ranked game yet. */
export async function loadPosition(supabase: SupabaseClient, userId: string, game = "joker"): Promise<number | null> {
  const { data } = await supabase.rpc("get_position", { p_user: userId, p_game: game });
  return data === null || data === undefined ? null : Number(data);
}
