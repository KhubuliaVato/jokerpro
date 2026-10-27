"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { GAMES } from "@/lib/games";
import { rankFor } from "@/lib/ranks";
import { loadLeaderboard, loadPosition, type LeaderRow } from "@/lib/ratings";
import { getSupabase } from "@/lib/supabase";
import { Avatar } from "./Avatar";
import { PageShell } from "./PageShell";
import { RankEmblem } from "./RankEmblem";
import { rise } from "./ui";

const MEDAL = ["#fcd34d", "#cbd5e1", "#fb923c"];

/** The best players of a game, top three on a podium, then the list. */
export function LeaderboardPage() {
  const { user, configured } = useAuth();
  const [gameId, setGameId] = useState(GAMES[0].id);
  const [board, setBoard] = useState<{ gameId: string; rows: LeaderRow[]; error: string | null } | null>(null);
  const [mine, setMine] = useState<{ userId: string; gameId: string; position: number | null } | null>(null);

  const userId = user?.id ?? null;
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;
    loadLeaderboard(supabase, gameId, 100).then(({ rows, error }) => {
      if (!cancelled) setBoard({ gameId, rows, error });
    });
    return () => {
      cancelled = true;
    };
  }, [gameId]);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    loadPosition(supabase, userId, gameId).then((position) => {
      if (!cancelled) setMine({ userId, gameId, position });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, gameId]);

  const current = board && board.gameId === gameId ? board : null;
  const rows = current?.rows ?? [];
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const myPosition = mine && mine.userId === userId && mine.gameId === gameId ? mine.position : null;
  const iAmListed = rows.some((r) => r.user_id === userId);

  return (
    <PageShell width="max-w-4xl">
      <section className="flex flex-col gap-4" style={rise(1)}>
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">ლიდერბორდი</h1>
        <div className="flex flex-wrap gap-2">
          {GAMES.map((g) => (
            <button
              key={g.id}
              onClick={() => setGameId(g.id)}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-base font-bold transition-colors ${
                g.id === gameId ? "bg-amber-300 text-black" : "border border-white/15 text-white/60 hover:text-white"
              }`}
            >
              <span>{g.icon}</span>
              {g.name}
            </button>
          ))}
        </div>
      </section>

      {!configured ? (
        <p className="text-white/55">ლიდერბორდი ჯერ არ არის ჩართული.</p>
      ) : !current ? (
        <div className="h-64 animate-pulse rounded-3xl bg-white/[0.06]" />
      ) : current.error ? (
        <p className="text-red-300">ვერ ჩაიტვირთა: {current.error}</p>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/20 px-6 py-14 text-center" style={rise(2)}>
          <p className="text-xl text-white/60">ჯერ არავის დაუსრულებია რეიტინგული თამაში.</p>
          <p className="mt-2 text-white/40">იყავით პირველი, ითამაშეთ ‹წოდებისთვის ბრძოლა›.</p>
          <Link href="/joker/ranked" className="mt-6 inline-block rounded-full bg-amber-300 px-7 py-3 text-lg font-extrabold text-black">
            თამაში
          </Link>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-3 items-end gap-3 sm:gap-6" style={rise(2)}>
            {[1, 0, 2].map((i) => {
              const p = podium[i];
              if (!p) return <div key={i} />;
              const standing = rankFor(p.rating);
              const first = i === 0;
              // Tied players share the medal of their position.
              const medal = MEDAL[Math.min(p.pos - 1, 2)];
              return (
                <Link
                  key={p.user_id}
                  href={p.user_id === userId ? "/profile" : `/players/${p.user_id}`}
                  className="group flex flex-col items-center gap-2 text-center"
                >
                  <div className="relative">
                    <div
                      className="rounded-full p-1"
                      style={{ background: `linear-gradient(160deg, ${medal}, ${medal}55)` }}
                    >
                      <Avatar
                        size={first ? "xl" : "lg"}
                        color={p.avatar_color}
                        icon={p.avatar_icon}
                        url={p.avatar_url}
                      />
                    </div>
                    <span
                      className="absolute -bottom-2 left-1/2 grid size-8 -translate-x-1/2 place-items-center rounded-full text-base font-black text-black"
                      style={{ background: medal }}
                    >
                      {p.pos}
                    </span>
                  </div>
                  <b className="mt-3 max-w-full truncate text-lg font-extrabold group-hover:text-amber-300 sm:text-xl">
                    {p.nickname}
                  </b>
                  <RankEmblem rank={standing.rank} className={first ? "size-16" : "size-12"} />
                  <span className="text-2xl font-black tabular-nums sm:text-3xl" style={{ color: standing.rank.accent }}>
                    {p.rating}
                  </span>
                  <div
                    className="mt-1 w-full rounded-t-2xl"
                    style={{
                      height: first ? "5rem" : i === 1 ? "3.6rem" : "2.8rem",
                      background: `linear-gradient(180deg, ${medal}33, transparent)`,
                    }}
                  />
                </Link>
              );
            })}
          </section>

          {rest.length > 0 && (
            <ul className="flex flex-col gap-2" style={rise(3)}>
              {rest.map((r) => (
                <Row key={r.user_id} r={r} me={r.user_id === userId} />
              ))}
            </ul>
          )}

          {userId && myPosition !== null && !iAmListed && (
            <div className="sticky bottom-4 z-10 rounded-2xl border border-amber-300/40 bg-[#0d2a1e]/95 px-5 py-3 shadow-lg backdrop-blur">
              <Link href="/profile" className="flex items-center justify-between gap-3">
                <span className="font-bold text-amber-300">თქვენი ადგილი</span>
                <b className="text-2xl tabular-nums">#{myPosition}</b>
              </Link>
            </div>
          )}
          <div className="pb-8" />
        </>
      )}
    </PageShell>
  );
}

function Row({ r, me }: { r: LeaderRow; me: boolean }) {
  const standing = rankFor(r.rating);
  const winRate = r.games > 0 ? Math.round((r.wins / r.games) * 100) : 0;
  return (
    <li>
      <Link
        href={me ? "/profile" : `/players/${r.user_id}`}
        className={`flex items-center gap-4 rounded-2xl border px-4 py-3 transition-[border-color,background-color,translate] duration-200 hover:-translate-y-0.5 hover:border-white/30 ${
          me ? "border-amber-300/50 bg-amber-300/10" : "border-white/10 bg-white/[0.03]"
        }`}
      >
        <b className="w-10 text-center text-lg tabular-nums text-white/50">{r.pos}</b>
        <Avatar size="md" color={r.avatar_color} icon={r.avatar_icon} url={r.avatar_url} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-bold">
            {r.nickname}
            {me && <span className="ml-2 text-sm font-semibold text-amber-300">თქვენ</span>}
          </span>
          <span className="block text-sm text-white/45">
            {r.games} თამაში · {winRate}% გამარჯვება
          </span>
        </span>
        <span className="hidden items-center gap-2 sm:flex">
          <RankEmblem rank={standing.rank} className="size-9" glow={false} />
          <span className="text-sm font-bold" style={{ color: standing.rank.accent }}>
            {standing.rank.name}
          </span>
        </span>
        <b className="w-16 text-right text-2xl tabular-nums">{r.rating}</b>
      </Link>
    </li>
  );
}
