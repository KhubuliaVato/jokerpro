"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Card } from "@/lib/joker/cards";
import { useAuth } from "@/lib/auth/AuthProvider";
import { loadResults } from "@/lib/results";
import { computeStats, type Stats } from "@/lib/stats";
import { getSupabase } from "@/lib/supabase";
import { CardView } from "./CardView";
import { SiteHeader } from "./SiteHeader";
import { RISE_CSS, rise } from "./ui";

const ACE: Card = { joker: false, suit: "S", rank: 14, id: "S14" };
const JOKER: Card = { joker: true, id: "J0" };
const KING: Card = { joker: false, suit: "H", rank: 13, id: "H13" };

const CARD_SIZE = { ["--cw" as string]: "clamp(5.5rem, 14vw, 7.5rem)" } as React.CSSProperties;

export function MainMenu() {
  const { user, profile, configured, loading } = useAuth();
  const [loaded, setLoaded] = useState<{ userId: string; stats: Stats } | null>(null);

  const userId = user?.id ?? null;
  const stats = loaded && loaded.userId === userId ? loaded.stats : null;
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    loadResults(supabase, userId).then(({ results }) => {
      if (!cancelled) setLoaded({ userId, stats: computeStats(results) });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[radial-gradient(ellipse_at_50%_-10%,#17623f,#0a2418_70%)]">
      <style>{RISE_CSS}</style>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-5 py-6 sm:gap-12 sm:px-8 sm:py-8">
        <div style={rise(0)}>
          <SiteHeader />
        </div>

        <section className="flex flex-col gap-3" style={rise(1)}>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            {user ? (
              <>
                გამარჯობა, <span className="text-amber-300">{profile?.nickname ?? "მოთამაშე"}</span>
              </>
            ) : (
              "თამაშები"
            )}
          </h1>
          <p className="text-lg text-white/55 sm:text-xl">
            {user && stats && stats.played > 0 ? (
              <>
                {stats.played} თამაში · {stats.wins} გამარჯვება · {stats.winRate}%
              </>
            ) : user ? (
              "აირჩიეთ თამაში და დაიწყეთ."
            ) : (
              "აირჩიეთ თამაში."
            )}
          </p>
          {!loading && !user && configured && (
            <Link
              href="/login"
              className="mt-1 w-fit text-base text-white/55 underline decoration-white/25 underline-offset-4 transition-colors hover:text-amber-300 hover:decoration-amber-300"
            >
              შექმენით პროფილი, რომ შედეგები შეინახოთ
            </Link>
          )}
        </section>

        <section className="grid gap-5 sm:grid-cols-[repeat(2,minmax(0,1fr))] sm:gap-8" style={rise(2)}>
          <Link href="/joker" className="group block outline-none">
            <div className="flex min-h-[min(28rem,50dvh)] flex-col justify-between rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 transition-[translate,border-color,background-color,box-shadow] duration-300 ease-out group-hover:-translate-y-2 group-hover:border-white/30 group-hover:bg-white/[0.07] group-hover:shadow-[0_30px_60px_-20px_rgb(0_0_0/0.6)] group-focus-visible:border-amber-300 sm:p-9">
              <div className="relative grid flex-1 place-items-center py-6">
                <div className="relative h-44 w-full">
                  <div className="absolute bottom-0 left-1/2 origin-bottom -translate-x-[calc(50%+3.6rem)] -rotate-[9deg] transition-[rotate,translate] duration-500 ease-out group-hover:-translate-x-[calc(50%+5.2rem)] group-hover:-rotate-[17deg]">
                    <CardView card={ACE} style={CARD_SIZE} />
                  </div>
                  <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 transition-[translate] duration-500 ease-out group-hover:-translate-y-4">
                    <CardView card={JOKER} style={CARD_SIZE} />
                  </div>
                  <div className="absolute bottom-0 left-1/2 origin-bottom -translate-x-[calc(50%-3.6rem)] rotate-[9deg] transition-[rotate,translate] duration-500 ease-out group-hover:-translate-x-[calc(50%-5.2rem)] group-hover:rotate-[17deg]">
                    <CardView card={KING} style={CARD_SIZE} />
                  </div>
                </div>
              </div>
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-4xl font-extrabold sm:text-5xl">ჯოკერი</h2>
                  <p className="mt-1.5 text-base text-white/55">ბოტებთან · 4 მოთამაშე</p>
                </div>
                <span className="flex items-center gap-2 whitespace-nowrap text-lg font-bold text-amber-300">
                  თამაში
                  <span className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
                </span>
              </div>
            </div>
          </Link>

          <div className="flex min-h-[min(28rem,50dvh)] flex-col justify-between rounded-[2rem] border border-dashed border-white/10 p-7 sm:p-9">
            <div className="grid flex-1 place-items-center text-7xl tracking-[0.3em] text-white/10">♣♦</div>
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-4xl font-extrabold text-white/40 sm:text-5xl">ონლაინ</h2>
                <p className="mt-1.5 text-base text-white/30">მეგობრებთან ერთად</p>
              </div>
              <span className="whitespace-nowrap rounded-full border border-white/15 px-4 py-1.5 text-sm font-bold text-white/40">
                მალე
              </span>
            </div>
          </div>
        </section>

        {!configured && (
          <p className="text-sm text-white/40">
            პროფილები ჯერ არ არის ჩართული (Supabase არ არის მიერთებული), მაგრამ ჯოკერის თამაში შეიძლება.
          </p>
        )}
      </div>
    </main>
  );
}
