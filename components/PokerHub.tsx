"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { activeTable, tablePath, type TableRow } from "@/lib/online/client";
import { useT } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";
import { IconBot, IconTable, ModeCard } from "./ModeHub";
import { PageShell } from "./PageShell";
import { rise } from "./ui";

/** The two ways into poker: a private table of friends (online), or practice against bots. */
export function PokerHub() {
  const { user, configured } = useAuth();
  const tr = useT();
  const userId = user?.id ?? null;
  const [running, setRunning] = useState<{ userId: string; table: TableRow | null } | null>(null);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    activeTable(supabase).then((t) => {
      if (!cancelled) setRunning({ userId, table: t });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  const runningTable = running && running.userId === userId && running.table?.game === "poker" ? running.table : null;
  const privateHref = user || !configured ? "/poker/private" : `/login?next=${encodeURIComponent("/poker/private")}`;

  return (
    <PageShell width="max-w-5xl">
      <section className="flex flex-col gap-2" style={rise(1)}>
        <p className="text-sm font-bold uppercase tracking-wider text-white/45">{tr("პოკერი", "Poker", "Покер")} · Texas Hold&apos;em</p>
        <h1 className="text-[clamp(1.8rem,11.5vw,3rem)] font-extrabold tracking-tight sm:text-7xl">{tr("აირჩიეთ რეჟიმი", "Choose a mode", "Выберите режим")}</h1>
        <p className="text-lg text-white/55 sm:text-xl">{tr("სათამაშო ჩიპებით: ფული არ გამოიყენება და არაფერი იწერება", "Play chips only: no real money and nothing is recorded", "Игровые фишки: без денег, ничего не записывается")}</p>
      </section>

      {runningTable && (
        <Link
          href={tablePath(runningTable)}
          className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-400/50 bg-emerald-400/10 px-5 py-4 transition-colors hover:bg-emerald-400/15"
          style={rise(1)}
        >
          <span>
            <b className="block text-lg text-emerald-300">{tr("თამაში გრძელდება", "Game in progress", "Игра продолжается")}</b>
            <span className="text-white/60">{tr("პოკერი", "Poker", "Покер")} · {tr("დაბრუნდით თქვენს მაგიდასთან", "back to your table", "вернитесь за свой стол")}</span>
          </span>
          <span className="text-2xl text-emerald-300">→</span>
        </Link>
      )}

      <section className="grid grid-cols-[minmax(0,1fr)] gap-4 pb-8 sm:grid-cols-2 sm:gap-5" style={rise(2)}>
        <ModeCard
          href={privateHref}
          title={tr("კერძო მაგიდა", "Private table", "Частный стол")}
          text={tr("2-6 მეგობარი, შეიყვანეთ კოდით", "2-6 friends, join with a code", "2-6 друзей, вход по коду")}
          accent="#86efac"
          featured
          note={!user && configured ? tr("შესვლა საჭიროა", "Sign-in required", "Нужен вход") : undefined}
          art={<IconTable />}
        />
        <ModeCard href="/poker/bots" title={tr("ბოტებთან", "Vs bots", "С ботами")} text={tr("სავარჯიშო თამაში, არაფერი იწერება", "Practice game, nothing is recorded", "Тренировочная игра, ничего не записывается")} accent="#c4b5fd" art={<IconBot />} />
      </section>
    </PageShell>
  );
}
