"use client";

import { useEffect, useState } from "react";
import { playMatchFound } from "@/lib/matchSound";
import { READY_SECONDS } from "@/lib/online/client";
import { rankFor } from "@/lib/ranks";
import { loadRatings, type RatingRow } from "@/lib/ratings";
import type { BuraRules } from "@/lib/bura/online";
import type { Rules } from "@/lib/joker/rules";
import { getSupabase } from "@/lib/supabase";
import type { useOnlineTable } from "@/lib/online/useOnlineTable";
import { Avatar } from "./Avatar";
import { PageShell } from "./PageShell";
import { RankEmblem } from "./RankEmblem";
import { BTN_GHOST, BTN_PRIMARY, FORMAT_LABEL, rise } from "./ui";

type Player = ReturnType<typeof useOnlineTable>["players"][number];

const LAMPS = `
@keyframes lamp-on{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}
@keyframes lamp-glow{0%,100%{box-shadow:0 0 22px 2px rgb(255 200 80 / .45)}50%{box-shadow:0 0 38px 8px rgb(255 200 80 / .75)}}
@keyframes table-open{0%{transform:scale(1)}40%{transform:scale(1.06)}100%{transform:scale(1)}}
`;

// Seats as the player sees them: me at the bottom, then clockwise.
const POSITION = [
  "bottom-0 left-1/2 -translate-x-1/2",
  "left-0 top-1/2 -translate-y-1/2",
  "left-1/2 top-0 -translate-x-1/2",
  "right-0 top-1/2 -translate-y-1/2",
];

// Two seats: me at the bottom, the other player across.
const POSITION_2 = ["bottom-0 left-1/2 -translate-x-1/2", "left-1/2 top-0 -translate-x-1/2"];

/** The waiting room of a table of random players: four lamps around a table that light up as players sit down. */
export function QueueLobby({
  kind,
  rules,
  game,
  players,
  full,
  readyLeft,
  onAccept,
  onLeave,
}: {
  kind: "ranked" | "friendly";
  rules: Rules | BuraRules;
  game: "joker" | "bura";
  players: Player[];
  full: boolean;
  /** Seconds left to accept the found match, or null while the table is not full (or all accepted). */
  readyLeft: number | null;
  onAccept: () => void;
  onLeave: () => void;
}) {
  const seated = players.filter(Boolean).length;
  const checking = readyLeft !== null;
  const mine = players[0];

  // How long the search has lasted.
  const [since] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (checking) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [checking]);
  const waited = Math.max(0, Math.floor((now - since) / 1000));
  const clock = `${Math.floor(waited / 60)}:${String(waited % 60).padStart(2, "0")}`;

  // "Match found": a chime when the ready check opens.
  useEffect(() => {
    if (checking) playMatchFound();
  }, [checking]);
  const ids = players.flatMap((p) => (p ? [p.user_id] : []));
  const idKey = ids.join(",");

  // Ranked: show everyone's rank next to their name.
  const [ratings, setRatings] = useState<{ key: string; byId: Record<string, RatingRow> } | null>(null);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || kind !== "ranked" || ids.length === 0) return;
    let cancelled = false;
    loadRatings(supabase, ids).then((byId) => {
      if (!cancelled) setRatings({ key: idKey, byId });
    });
    return () => {
      cancelled = true;
    };
    // `ids` is rebuilt every render; its joined key is what identifies the set of players.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey, kind]);
  const byId = ratings && ratings.key === idKey ? ratings.byId : {};

  return (
    <PageShell width="max-w-3xl">
      <style>{LAMPS}</style>

      <section className="flex flex-col gap-2" style={rise(1)}>
        <p className="text-sm font-bold uppercase tracking-wider text-white/45">
          {kind === "ranked" ? "წოდებისთვის ბრძოლა" : "მეგობრული მატჩი"} · {game === "bura" ? ((rules as BuraRules).players === 4 ? "4 მოთამაშე · 2×2" : "2 მოთამაშე") : FORMAT_LABEL[(rules as Rules).format]}
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
          {checking ? "მატჩი ნაპოვნია!" : full ? "მაგიდა იღება…" : "ვეძებთ მოთამაშეებს"}
        </h1>
      </section>

      <section className="grid place-items-center py-4" style={rise(2)}>
        <div className="relative aspect-square w-[min(92vw,30rem)]">
          {checking && (
            <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-[24%] -rotate-90">
              <circle cx="50" cy="50" r="48" fill="none" stroke="rgb(255 255 255 / .1)" strokeWidth="1.5" />
              <circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke={readyLeft <= 8 ? "rgb(248 113 113)" : "rgb(252 211 77)"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 48}
                strokeDashoffset={2 * Math.PI * 48 * (1 - readyLeft / READY_SECONDS)}
                style={{ transition: "stroke-dashoffset 0.3s linear" }}
              />
            </svg>
          )}
          {/* the table */}
          <div
            className="absolute inset-[28%] grid place-items-center rounded-[2.5rem] border-4 border-amber-300/50 bg-[radial-gradient(ellipse_at_50%_40%,#1f7a4d,#0d4128_80%)] shadow-[inset_0_0_40px_rgb(0_0_0/0.45),0_18px_40px_-14px_rgb(0_0_0/0.7)]"
            style={full ? { animation: "table-open 0.9s ease-in-out infinite" } : undefined}
          >
            {checking ? (
              <div className="text-center">
                <b className="block text-6xl font-black tabular-nums text-amber-200 sm:text-7xl">{readyLeft}</b>
                <span className="text-sm text-white/55">წამი</span>
              </div>
            ) : (
              <div className="text-center">
                <b className="block text-5xl font-black tabular-nums text-amber-200 sm:text-6xl">{full ? `${players.length}/${players.length}` : clock}</b>
                <span className="text-sm text-white/55">{full ? "იწყება" : `${seated}/${players.length} · ძებნა`}</span>
              </div>
            )}
          </div>

          {players.map((p, k) => {
            const standing = p ? rankFor(byId[p.user_id]?.rating ?? 50) : null;
            return (
              <div key={k} className={`absolute flex w-28 flex-col items-center gap-2 ${(players.length === 2 ? POSITION_2 : POSITION)[k]}`}>
                {p ? (
                  <>
                    <div
                      className="relative rounded-full p-1"
                      style={{
                        animation: "lamp-on 0.5s ease-out both, lamp-glow 2.4s ease-in-out 0.5s infinite",
                        background: "radial-gradient(circle, rgb(255 214 120 / .9), rgb(255 190 60 / .5))",
                      }}
                    >
                      <Avatar
                        size="lg"
                        color={p.profile?.avatar_color}
                        icon={p.profile?.avatar_icon}
                        url={p.profile?.avatar_url}
                      />
                      {kind === "ranked" && standing && (
                        <span className="absolute -bottom-2 -right-3">
                          <RankEmblem rank={standing.rank} className="size-9" glow={false} />
                        </span>
                      )}
                    </div>
                    {checking && (
                      <span className={`text-sm font-bold ${p.accepted ? "text-emerald-300" : "text-white/40"}`}>
                        {p.accepted ? "✓ მზადაა" : "ელოდება…"}
                      </span>
                    )}
                    <span className="max-w-full truncate text-center text-base font-bold">
                      {p.profile?.nickname ?? "…"}
                      {k === 0 && <span className="ml-1 text-xs font-semibold text-amber-300">თქვენ</span>}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="grid size-24 animate-pulse place-items-center rounded-full border-2 border-dashed border-white/20 text-3xl text-white/25">
                      ?
                    </div>
                    <span className="text-sm text-white/35">ელოდება</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col items-center gap-4 pb-8" style={rise(3)}>
        {checking && (
          <button className={`${BTN_PRIMARY} min-w-60 text-xl`} onClick={onAccept} disabled={!!mine?.accepted}>
            {mine?.accepted ? "ველოდებით დანარჩენებს…" : "დადასტურება"}
          </button>
        )}
        <button className={BTN_GHOST} onClick={onLeave}>
          გაუქმება
        </button>
      </div>
    </PageShell>
  );
}
