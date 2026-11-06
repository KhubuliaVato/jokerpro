"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";

/** The quick reactions at the end of a game (the game's own chat is gone by then). */
export const END_REACTIONS = ["GG", "👏", "🔥", "😅", "😎", "🤝"] as const;
export type EndReaction = (typeof END_REACTIONS)[number];

const SHOWN_MS = 4000;

/**
 * Reactions of the players of a finished table, sent over a Realtime broadcast channel (nothing is stored):
 * `shown` maps a player's id to the reaction they sent a moment ago.
 */
export function useEndReactions(tableId: string | null, myId: string | null) {
  const [shown, setShown] = useState<Record<string, EndReaction>>({});
  const channelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getSupabase>>["channel"]> | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !tableId) return;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const channel = supabase
      .channel(`end:${tableId}`, { config: { broadcast: { self: true } } })
      .on("broadcast", { event: "react" }, ({ payload }) => {
        const from = typeof payload?.from === "string" ? payload.from : null;
        const code = payload?.code as EndReaction;
        if (!from || !END_REACTIONS.includes(code)) return;
        setShown((s) => ({ ...s, [from]: code }));
        const id = setTimeout(() => {
          timers.delete(id);
          setShown((s) => {
            if (s[from] !== code) return s;
            const rest = { ...s };
            delete rest[from];
            return rest;
          });
        }, SHOWN_MS);
        timers.add(id);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      timers.forEach(clearTimeout);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [tableId]);

  const send = useCallback(
    (code: EndReaction) => {
      // at most one a second
      if (!myId || !channelRef.current || Date.now() - lastSent.current < 1000) return;
      lastSent.current = Date.now();
      void channelRef.current.send({ type: "broadcast", event: "react", payload: { from: myId, code } });
    },
    [myId],
  );

  return { shown, send };
}
