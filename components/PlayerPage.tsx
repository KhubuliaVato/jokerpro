"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { loadResults } from "@/lib/results";
import { loadPlayer, type PlayerSummary } from "@/lib/search";
import type { GameResult } from "@/lib/stats";
import { getSupabase } from "@/lib/supabase";
import { PageShell } from "./PageShell";
import { PlayerHero } from "./PlayerHero";
import { StatsSection } from "./StatsSection";
import { BTN_GHOST, rise } from "./ui";

/** Public page of any player: the same stats as one's own profile, without the editing. */
export function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const { configured } = useAuth();
  const [player, setPlayer] = useState<PlayerSummary | null | undefined>(undefined);
  const [results, setResults] = useState<GameResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !id) return;
    let cancelled = false;
    (async () => {
      const [{ player: p, error: e1 }, { results: rows, error: e2 }] = await Promise.all([
        loadPlayer(supabase, id),
        loadResults(supabase, id),
      ]);
      if (cancelled) return;
      setPlayer(p);
      setResults(rows);
      setError(e1 ?? e2);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <PageShell width="max-w-5xl">
      <div style={rise(1)}>
        <Link href="/profile" className={`${BTN_GHOST} inline-flex w-fit items-center gap-2`}>
          <span>←</span> ძიება
        </Link>
      </div>

      {!configured ? (
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">პროფილები ჯერ არ არის ჩართული</h1>
      ) : player === undefined ? (
        <div className="h-48 animate-pulse rounded-3xl bg-white/[0.06]" />
      ) : player === null ? (
        <section className="flex flex-col gap-3" style={rise(1)}>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">მოთამაშე ვერ მოიძებნა</h1>
          {error && <p className="text-sm text-red-300">{error}</p>}
        </section>
      ) : (
        <>
          <PlayerHero player={player} />
          <StatsSection userId={player.id} results={results} loadError={error} name={player.nickname} />
        </>
      )}
    </PageShell>
  );
}
