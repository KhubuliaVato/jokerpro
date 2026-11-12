import { useEffect, useState } from "react";
import { levelInfo, loadXp } from "@/lib/level";
import { getSupabase } from "@/lib/supabase";

/** The level of a player (level 1 until it is loaded). */
export function useLevel(userId: string | null | undefined) {
  const [state, setState] = useState<{ userId: string; xp: number } | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    loadXp(supabase, userId).then((xp) => {
      if (!cancelled) setState({ userId, xp });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return levelInfo(state && state.userId === userId ? state.xp : 0);
}
