"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export interface ChatMessage {
  id: number;
  user_id: string;
  body: string;
  created_at: string;
}

/** The chat of one table, kept live through Realtime. The server deletes it when the game is over. */
export function useTableChat(tableId: string | null, over: boolean) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !tableId) return;
    const { data } = await supabase
      .from("table_messages")
      .select("id, user_id, body, created_at")
      .eq("table_id", tableId)
      .order("id")
      .limit(200);
    if (data) setMessages(data as ChatMessage[]);
  }, [tableId]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !tableId || over) return;
    const first = setTimeout(() => void load(), 0);
    const channel = supabase
      .channel(`chat-${tableId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "table_messages", filter: `table_id=eq.${tableId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m].slice(-200)));
        },
      )
      .subscribe();
    // Realtime is the fast path; this slow poll only repairs a missed message.
    const poll = setInterval(() => void load(), 15000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [tableId, over, load]);

  const send = useCallback(
    async (body: string) => {
      const supabase = getSupabase();
      if (!supabase || !tableId) return;
      await supabase.rpc("send_table_message", { p_table_id: tableId, p_body: body });
    },
    [tableId],
  );

  return { messages: over ? [] : messages, send };
}
