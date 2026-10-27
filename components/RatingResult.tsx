"use client";

import { useEffect, useState } from "react";
import { rankFor } from "@/lib/ranks";
import { getSupabase } from "@/lib/supabase";
import { RankEmblem } from "./RankEmblem";

interface Outcome {
  before: number;
  after: number;
}

/**
 * After a ranked game: the change of rating and, if it happened, the new (or lost) rank.
 * The server writes the result a moment after the last move, so this asks a few times.
 */
export function RatingResult({ tableId, userId }: { tableId: string; userId: string }) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;
    let tries = 0;
    const look = async () => {
      const { data } = await supabase
        .from("game_results")
        .select("rating_before, rating_after")
        .eq("table_id", tableId)
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (data && data.rating_before !== null && data.rating_after !== null) {
        setOutcome({ before: data.rating_before, after: data.rating_after });
      } else if (++tries < 15) {
        timer = setTimeout(look, 1000);
      }
    };
    let timer = setTimeout(look, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tableId, userId]);

  if (!outcome) return <span className="text-white/50">ქულა ითვლება…</span>;

  const delta = outcome.after - outcome.before;
  const was = rankFor(outcome.before).rank;
  const now = rankFor(outcome.after);
  const moved = was.index !== now.rank.index;
  const up = now.rank.index > was.index;

  return (
    <div className="flex flex-col items-center gap-2">
      <style>{"@keyframes rating-pop{0%{transform:scale(.5);opacity:0}70%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}"}</style>
      <div className="flex items-center gap-4">
        <RankEmblem rank={now.rank} className="size-14" />
        <div className="text-left">
          <b
            className={`block text-4xl font-black tabular-nums ${delta > 0 ? "text-emerald-300" : delta < 0 ? "text-red-300" : "text-white/70"}`}
            style={{ animation: "rating-pop 0.5s ease-out both" }}
          >
            {delta > 0 ? `+${delta}` : delta}
          </b>
          <span className="text-sm text-white/60">
            {outcome.after} ქულა · {now.rank.name}
          </span>
        </div>
      </div>
      {moved && (
        <b className={up ? "text-amber-300" : "text-red-300"}>
          {up ? `ახალი წოდება: ${now.rank.name} ★` : `წოდება დაგეკარგათ: ახლა ${now.rank.name}`}
        </b>
      )}
    </div>
  );
}
