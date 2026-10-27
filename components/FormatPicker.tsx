"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { findTable } from "@/lib/online/client";
import { rankFor } from "@/lib/ranks";
import { loadRating, type RatingRow } from "@/lib/ratings";
import { getSupabase } from "@/lib/supabase";
import { PageShell } from "./PageShell";
import { RankEmblem } from "./RankEmblem";
import { BTN_PRIMARY, rise } from "./ui";

const FORMATS = [
  { value: "nine", big: "9", title: "ცხრიანები", hint: "16 ხელი, თითოეულში 9 კარტი" },
  { value: "full", big: "24", title: "კლასიკური", hint: "24 ხელი, 4 ეტაპი: 1–8, 9×4, 8–1, 9×4" },
] as const;

const TEXT = {
  ranked: {
    title: "წოდებისთვის ბრძოლა",
    sub: "თამაში შემთხვევით მოთამაშეებთან. შედეგი ცვლის ქულას და წოდებას.",
  },
  friendly: {
    title: "მეგობრული მატჩი",
    sub: "თამაში შემთხვევით მოთამაშეებთან. ქულა არ იცვლება, თამაში ისტორიაში ჩაიწერება.",
  },
} as const;

/** Pick the game length, then take a seat at an open table of random players. */
export function FormatPicker({ kind }: { kind: "ranked" | "friendly" }) {
  const router = useRouter();
  const { configured, loading, user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ userId: string; row: RatingRow | null } | null>(null);

  const userId = user?.id ?? null;
  const rating = loaded && loaded.userId === userId ? loaded.row : null;
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId || kind !== "ranked") return;
    let cancelled = false;
    loadRating(supabase, userId).then((row) => {
      if (!cancelled) setLoaded({ userId, row });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, kind]);

  const enter = async (format: "nine" | "full") => {
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(format);
    setError(null);
    const { table, error: err } = await findTable(supabase, kind, format);
    if (err || !table) {
      setError(err ?? "მაგიდა ვერ მოიძებნა");
      setBusy(null);
      return;
    }
    router.push(`/joker/table/${table.code}`);
  };

  const standing = rankFor(rating?.rating ?? 50);

  return (
    <PageShell width="max-w-4xl">
      <section className="flex flex-col gap-2" style={rise(1)}>
        <Link href="/joker" className="w-fit text-sm font-bold uppercase tracking-wider text-white/45 hover:text-amber-300">
          ← ჯოკერი
        </Link>
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">{TEXT[kind].title}</h1>
        <p className="text-lg text-white/55 sm:text-xl">{TEXT[kind].sub}</p>
      </section>

      {!configured ? (
        <p className="text-white/55">ონლაინ თამაში ჯერ არ არის ჩართული.</p>
      ) : loading ? null : !user ? (
        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6" style={rise(2)}>
          <p className="text-lg text-white/70">ამ რეჟიმისთვის საჭიროა ანგარიში.</p>
          <Link href={`/login?next=/joker/${kind}`} className={`${BTN_PRIMARY} w-fit`}>
            შესვლა
          </Link>
        </div>
      ) : (
        <>
          {kind === "ranked" && (
            <div
              className="flex items-center gap-4 rounded-3xl border bg-white/[0.04] px-5 py-4"
              style={{ borderColor: `${standing.rank.accent}44` }}
            >
              <RankEmblem rank={standing.rank} className="size-14" />
              <div>
                <b className="text-xl" style={{ color: standing.rank.accent }}>
                  {standing.rank.name}
                </b>
                <p className="text-white/55">{rating ? `${rating.rating} ქულა` : "ჯერ არ გიყვიათ რეიტინგული თამაში, იწყებთ 50 ქულით"}</p>
              </div>
            </div>
          )}

          <section className="grid gap-5 pb-8 sm:grid-cols-2" style={rise(2)}>
            {FORMATS.map((f) => (
              <button
                key={f.value}
                onClick={() => enter(f.value)}
                disabled={busy !== null}
                className="group relative block text-left outline-none disabled:opacity-60"
              >
                <span className="flex min-h-72 flex-col justify-between rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 transition-[translate,border-color,background-color,box-shadow] duration-300 ease-out group-hover:-translate-y-2 group-hover:border-amber-300/70 group-hover:bg-white/[0.08] group-hover:shadow-[0_26px_50px_-24px_rgb(232_196_106/0.5)] group-focus-visible:border-amber-300">
                  <span className="text-8xl font-black leading-none tabular-nums text-amber-300">{f.big}</span>
                  <span>
                    <span className="block text-3xl font-extrabold">{f.title}</span>
                    <span className="mt-1 block text-base text-white/55">{f.hint}</span>
                    <span className="mt-5 flex items-center gap-2 text-lg font-bold text-amber-300">
                      {busy === f.value ? "ვეძებთ…" : "მაგიდის პოვნა"}
                      <span className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </section>

          {error && (
            <p role="alert" className="-mt-4 pb-6 text-base text-red-300">
              {error}
            </p>
          )}
        </>
      )}
    </PageShell>
  );
}
