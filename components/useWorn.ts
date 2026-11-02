import { useEffect, useState } from "react";
import { loadWorn, NOTHING_WORN, type Worn } from "@/lib/cosmetics";
import { PROFILE_CHANGED } from "@/lib/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase";

/** What a player wears (frame, nickname style, ...); nothing until it is loaded. */
export function useWorn(userId: string | null | undefined): Worn {
  const [state, setState] = useState<{ userId: string; worn: Worn } | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    const load = () =>
      loadWorn(supabase, userId).then((worn) => {
        if (!cancelled) setState({ userId, worn });
      });
    void load();
    window.addEventListener(PROFILE_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener(PROFILE_CHANGED, load);
    };
  }, [userId]);

  return state && state.userId === userId ? state.worn : NOTHING_WORN;
}
