import type { SupabaseClient } from "@supabase/supabase-js";

export interface CoinGrant {
  amount: number;
  reason: "win" | "play" | "achievement";
  /** The achievement id for `achievement`; the result id for `win`. */
  ref: string;
  created_at: string;
}

/** The player's balance; 0 for a player who has not earned a coin yet (or when the coins are not set up). */
export async function loadBalance(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data } = await supabase.from("player_coins").select("balance").eq("user_id", userId).maybeSingle();
  return data?.balance ?? 0;
}

/** The coins a finished table paid this player (the win and any achievements it completed). */
export async function loadTableGrants(supabase: SupabaseClient, tableId: string, userId: string): Promise<CoinGrant[]> {
  const { data } = await supabase
    .from("coin_log")
    .select("amount, reason, ref, created_at")
    .eq("table_id", tableId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return (data ?? []) as CoinGrant[];
}

/** The player's latest grants, newest first. */
export async function loadRecentGrants(supabase: SupabaseClient, userId: string, limit = 8): Promise<CoinGrant[]> {
  const { data } = await supabase
    .from("coin_log")
    .select("amount, reason, ref, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as CoinGrant[];
}
