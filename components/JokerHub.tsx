"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { activeTable } from "@/lib/online/client";
import { rankFor, RANKS } from "@/lib/ranks";
import { loadRating, type RatingRow } from "@/lib/ratings";
import { getSupabase } from "@/lib/supabase";
import { PageShell } from "./PageShell";
import { RankEmblem } from "./RankEmblem";
import { rise } from "./ui";

/** The four ways into Joker. */
export function JokerHub() {
  const { user, configured } = useAuth();
  const [loaded, setLoaded] = useState<{ userId: string; row: RatingRow | null } | null>(null);

  const userId = user?.id ?? null;
  const rating = loaded && loaded.userId === userId ? loaded.row : null;
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    loadRating(supabase, userId).then((row) => {
      if (!cancelled) setLoaded({ userId, row });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // A game that is still running (the page was closed, say): offer the way back.
  const [running, setRunning] = useState<{ userId: string; code: string | null } | null>(null);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    activeTable(supabase).then((t) => {
      if (!cancelled) setRunning({ userId, code: t?.code ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  const runningCode = running && running.userId === userId ? running.code : null;

  const current = rankFor(rating?.rating ?? 50).rank;
  const online = configured; // the three online modes need the database and an account
  const loginFor = (path: string) => (user || !online ? path : `/login?next=${encodeURIComponent(path)}`);

  return (
    <PageShell width="max-w-5xl">
      <section className="flex flex-col gap-2" style={rise(1)}>
        <p className="text-sm font-bold uppercase tracking-wider text-white/45">ჯოკერი</p>
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">აირჩიეთ რეჟიმი</h1>
      </section>

      {runningCode && (
        <Link
          href={`/joker/table/${runningCode}`}
          className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-400/50 bg-emerald-400/10 px-5 py-4 transition-colors hover:bg-emerald-400/15"
          style={rise(1)}
        >
          <span>
            <b className="block text-lg text-emerald-300">თამაში გრძელდება</b>
            <span className="text-white/60">დაბრუნდით თქვენს მაგიდასთან</span>
          </span>
          <span className="text-2xl text-emerald-300">→</span>
        </Link>
      )}

      <section className="grid gap-5 pb-8 sm:grid-cols-2" style={rise(2)}>
        <ModeCard
          href={loginFor("/joker/ranked")}
          title="წოდებისთვის ბრძოლა"
          text="შემთხვევითი მოთამაშეები, ქულა და წოდება იცვლება"
          accent={current.accent}
          featured
          note={!user && online ? "შესვლა საჭიროა" : rating ? `${rating.rating} ქულა · ${current.name}` : "ახალი, 50 ქულით დაიწყებთ"}
          art={<RankEmblem rank={user ? current : RANKS[0]} className="size-20" />}
        />
        <ModeCard
          href={loginFor("/joker/friendly")}
          title="მეგობრული მატჩი"
          text="შემთხვევითი მოთამაშეები, ქულა არ იცვლება"
          accent="#7dd3fc"
          note={!user && online ? "შესვლა საჭიროა" : undefined}
          art={<IconCards />}
        />
        <ModeCard
          href={loginFor("/joker/private")}
          title="კერძო მაგიდა"
          text="მხოლოდ მეგობრები, შეიყვანეთ კოდით"
          accent="#86efac"
          note={!user && online ? "შესვლა საჭიროა" : undefined}
          art={<IconKey />}
        />
        <ModeCard
          href="/joker/bots"
          title="ბოტებთან"
          text="სავარჯიშო თამაში, არაფერი იწერება"
          accent="#c4b5fd"
          art={<IconBot />}
        />
      </section>
    </PageShell>
  );
}

function ModeCard({
  href,
  title,
  text,
  accent,
  art,
  note,
  featured,
}: {
  href: string;
  title: string;
  text: string;
  accent: string;
  art: React.ReactNode;
  note?: string;
  featured?: boolean;
}) {
  return (
    <Link href={href} className="group block outline-none">
      <div
        className="relative flex min-h-56 items-center gap-6 overflow-hidden rounded-[2rem] border bg-white/[0.04] p-6 transition-[translate,border-color,background-color,box-shadow] duration-300 ease-out group-hover:-translate-y-1.5 group-hover:bg-white/[0.07] group-focus-visible:border-amber-300 sm:p-8"
        style={{
          borderColor: featured ? `${accent}66` : "rgb(255 255 255 / 0.1)",
          boxShadow: featured ? `0 0 0 1px ${accent}22, 0 18px 50px -24px ${accent}88` : undefined,
        }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: `${accent}33` }}
        />
        <div className="relative grid size-24 flex-none place-items-center transition-transform duration-300 group-hover:scale-110">
          {art}
        </div>
        <div className="relative min-w-0 flex-1">
          <h2 className="text-2xl font-extrabold leading-tight sm:text-3xl">{title}</h2>
          <p className="mt-1.5 text-base text-white/55">{text}</p>
          {note && (
            <span className="mt-3 inline-block rounded-full px-3 py-1 text-sm font-bold" style={{ background: `${accent}22`, color: accent }}>
              {note}
            </span>
          )}
        </div>
        <span className="relative text-2xl text-white/30 transition-transform duration-300 group-hover:translate-x-1.5">→</span>
      </div>
    </Link>
  );
}

function IconCards() {
  return (
    <svg viewBox="0 0 64 64" className="size-20" fill="none" aria-hidden>
      <g transform="rotate(-14 24 36)">
        <rect x="8" y="12" width="28" height="40" rx="5" fill="#fbf8ef" />
        <path d="M22 24c-4 4-6 6-6 9a3.4 3.4 0 0 0 6 2c-.3 2-1 3.4-2.2 4.2h4.4c-1.2-.8-1.9-2.2-2.2-4.2a3.4 3.4 0 0 0 6-2c0-3-2-5-6-9z" fill="#d6443f" transform="translate(0 -2)" />
      </g>
      <g transform="rotate(12 42 34)">
        <rect x="26" y="12" width="28" height="40" rx="5" fill="#fbf8ef" />
        <path d="M40 28l5.5 9.5-5.5 9.5-5.5-9.5z" fill="#1d1d24" />
      </g>
    </svg>
  );
}

function IconKey() {
  return (
    <svg viewBox="0 0 64 64" className="size-20" fill="none" aria-hidden>
      <circle cx="22" cy="32" r="12" stroke="#86efac" strokeWidth="5" />
      <circle cx="22" cy="32" r="4" fill="#86efac" />
      <path d="M33 32h24M50 32v9M42 32v7" stroke="#86efac" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function IconBot() {
  return (
    <svg viewBox="0 0 64 64" className="size-20" fill="none" aria-hidden>
      <rect x="12" y="20" width="40" height="30" rx="9" fill="#c4b5fd" />
      <path d="M32 20V11" stroke="#c4b5fd" strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="9" r="4" fill="#ddd6fe" />
      <circle cx="24" cy="34" r="5" fill="#2e1065" />
      <circle cx="40" cy="34" r="5" fill="#2e1065" />
      <circle cx="25.5" cy="32.5" r="1.6" fill="#fff" />
      <circle cx="41.5" cy="32.5" r="1.6" fill="#fff" />
      <path d="M25 44h14" stroke="#2e1065" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
