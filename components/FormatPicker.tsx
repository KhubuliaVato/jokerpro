"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { findTable, tablePath } from "@/lib/online/client";
import { getSupabase } from "@/lib/supabase";
import { FORMAT_ART, FormatFan } from "./FormatArt";
import { PageShell } from "./PageShell";
import { BTN_PRIMARY, rise } from "./ui";

const FORMATS = { joker: ["nine", "full"], bura: ["p2", "p4"] } as const;
type Format = (typeof FORMATS)[keyof typeof FORMATS][number];

/** Ranked or friendly match: pick the game length, then take a seat at an open table of random players. */
export function FormatPicker({ kind, game = "joker" }: { kind: "ranked" | "friendly"; game?: "joker" | "bura" }) {
  const router = useRouter();
  const { configured, loading, user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enter = async (format: Format) => {
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(format);
    setError(null);
    const { table, error: err } = await findTable(supabase, kind, format, game);
    if (err || !table) {
      setError(err ?? "მაგიდა ვერ მოიძებნა");
      setBusy(null);
      return;
    }
    // `replace`, so that "back" from the lobby does not queue the player again.
    router.replace(tablePath(table));
  };

  return (
    <PageShell width="max-w-4xl">
      <section className="flex flex-col gap-2" style={rise(1)}>
        <Link href={`/${game}`} className="w-fit text-sm font-bold uppercase tracking-wider text-white/45 hover:text-amber-300">
          ← {game === "bura" ? "ბურა" : "ჯოკერი"}
        </Link>
        <h1 className="text-[clamp(1.8rem,11.5vw,3rem)] font-extrabold tracking-tight sm:text-7xl">{kind === "ranked" ? "წოდებისთვის ბრძოლა" : "მეგობრული მატჩი"}</h1>
        <p className="text-lg text-white/55 sm:text-xl">{kind === "ranked" ? "შემთხვევითი მოთამაშეები · წოდება იცვლება" : "შემთხვევითი მოთამაშეები · ქულა არ იცვლება"}</p>
      </section>

      {!configured ? (
        <p className="text-white/55">ონლაინ თამაში ჯერ არ არის ჩართული.</p>
      ) : loading ? null : !user ? (
        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6" style={rise(2)}>
          <p className="text-lg text-white/70">ამ რეჟიმისთვის საჭიროა ანგარიში.</p>
          <Link href={`/login?next=/${game}/${kind}`} className={`${BTN_PRIMARY} w-fit`}>
            შესვლა
          </Link>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-[minmax(0,1fr)] gap-5 pb-8 sm:grid-cols-2" style={rise(2)}>
            {FORMATS[game].map((f) => (
              <button
                key={f}
                onClick={() => enter(f)}
                disabled={busy !== null}
                className="group relative block text-left outline-none disabled:opacity-60"
              >
                <span className="relative flex min-h-80 flex-col justify-between overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-8 transition-[translate,border-color,box-shadow] duration-300 ease-out group-hover:-translate-y-2 group-hover:border-amber-300/70 group-hover:shadow-[0_26px_50px_-24px_rgb(232_196_106/0.55)] group-focus-visible:border-amber-300">
                  <span className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-amber-300/10 blur-3xl transition-opacity duration-500 group-hover:bg-amber-300/20" />
                  <FormatFan format={f} />

                  <span className="absolute right-6 top-5 flex items-center gap-2 text-xl font-bold text-amber-300">
                    {busy === f ? "ვეძებთ…" : ""}
                    <span className="text-3xl transition-transform duration-300 group-hover:translate-x-1.5">→</span>
                  </span>

                  <span className="relative mt-8 block text-3xl font-black tracking-tight sm:text-4xl">
                    {FORMAT_ART[f].title}
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
