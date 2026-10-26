import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/auth/AuthProvider";

/** What the search list needs of a player. */
export type PlayerSummary = Pick<
  Profile,
  "id" | "nickname" | "avatar_color" | "avatar_icon" | "avatar_url" | "created_at"
>;

const COLUMNS = "id, nickname, avatar_color, avatar_icon, avatar_url, created_at";

/** Makes user text safe inside an ILIKE pattern: `%`, `_` and `\` lose their special meaning. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Players whose nickname contains `query` (any case). An empty query returns the newest players. */
export async function searchPlayers(
  supabase: SupabaseClient,
  query: string,
  limit = 8,
): Promise<{ players: PlayerSummary[]; error: string | null }> {
  const q = query.trim();
  const base = supabase.from("profiles").select(COLUMNS).limit(limit);
  const { data, error } = q
    ? await base.ilike("nickname", `%${escapeLike(q)}%`).order("nickname")
    : await base.order("created_at", { ascending: false });
  return { players: (data ?? []) as PlayerSummary[], error: error ? error.message : null };
}

export async function loadPlayer(
  supabase: SupabaseClient,
  id: string,
): Promise<{ player: PlayerSummary | null; error: string | null }> {
  const { data, error } = await supabase.from("profiles").select(COLUMNS).eq("id", id).maybeSingle();
  return { player: (data as PlayerSummary | null) ?? null, error: error ? error.message : null };
}
