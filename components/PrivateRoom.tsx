"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { DEFAULT_RULES, type Rules } from "@/lib/joker/rules";
import { cleanCode, createTable, joinTable, tablePath } from "@/lib/online/client";
import { getSupabase } from "@/lib/supabase";
import { PageShell } from "./PageShell";
import { LABEL, RulesForm } from "./RulesForm";
import { BTN_GHOST, BTN_PRIMARY, INPUT, rise } from "./ui";

/** A private table for friends: create one and share its code, or enter a friend's code. Nothing is rated. */
export function PrivateRoom({ game = "joker" }: { game?: "joker" | "bura" }) {
  const router = useRouter();
  const { configured, loading, user } = useAuth();
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [players, setPlayers] = useState<2 | 4>(2);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Rules>) => setRules((r) => ({ ...r, ...patch }));

  const create = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { table, error: err } = await createTable(supabase, game === "bura" ? { game: "bura", players } : rules);
    if (err || !table) {
      setError(err ?? "მაგიდა ვერ შეიქმნა");
      setBusy(false);
      return;
    }
    router.replace(tablePath(table));
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase || joinCode.length < 6) return;
    setBusy(true);
    setError(null);
    const { table, error: err } = await joinTable(supabase, joinCode);
    if (err || !table) {
      setError(err ?? "მაგიდასთან შეერთება ვერ მოხერხდა");
      setBusy(false);
      return;
    }
    router.replace(tablePath(table));
  };

  return (
    <PageShell width="max-w-5xl">
      <section className="flex flex-col gap-2" style={rise(1)}>
        <Link href={`/${game}`} className="w-fit text-sm font-bold uppercase tracking-wider text-white/45 hover:text-amber-300">
          ← {game === "bura" ? "ბურა" : "ჯოკერი"}
        </Link>
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">კერძო მაგიდა</h1>
        <p className="text-lg text-white/55 sm:text-xl">მეგობრებთან · ქულა არ იცვლება</p>
      </section>

      {!configured ? (
        <p className="text-white/55">ონლაინ თამაში ჯერ არ არის ჩართული.</p>
      ) : loading ? null : !user ? (
        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6" style={rise(2)}>
          <p className="text-lg text-white/70">მაგიდისთვის საჭიროა ანგარიში.</p>
          <Link href={`/login?next=/${game}/private`} className={`${BTN_PRIMARY} w-fit`}>
            შესვლა
          </Link>
        </div>
      ) : (
        <div className="grid items-start gap-6 pb-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" style={rise(2)}>
          <section className="flex flex-col gap-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <h2 className="text-2xl font-extrabold">მაგიდის შექმნა</h2>
            {game === "bura" ? (
              <div className="grid grid-cols-2 gap-3">
                {([2, 4] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPlayers(n)}
                    aria-pressed={players === n}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      players === n ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-white/[0.03] hover:border-white/30"
                    }`}
                  >
                    <b className="block text-2xl">{n}</b>
                    <span className="text-white/55">{n === 2 ? "მოთამაშე" : "მოთამაშე · 2×2"}</span>
                  </button>
                ))}
              </div>
            ) : (
              <RulesForm rules={rules} onChange={set} />
            )}
            <button className={`${BTN_PRIMARY} w-full !py-4 !text-xl`} onClick={create} disabled={busy}>
              {busy ? "ერთი წამით…" : "შექმნა →"}
            </button>
          </section>

          <section className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <h2 className="text-2xl font-extrabold">შეერთება</h2>
            <form onSubmit={join} className="flex flex-col gap-4">
              <label className={`${LABEL} !mb-0`} htmlFor="join-code">
                მეგობრის კოდი
              </label>
              <input
                id="join-code"
                className={`${INPUT} text-center !text-3xl font-extrabold uppercase tracking-[0.35em]`}
                value={joinCode}
                onChange={(e) => setJoinCode(cleanCode(e.target.value))}
                placeholder="ABC123"
                autoComplete="off"
                spellCheck={false}
                maxLength={6}
              />
              <button className={`${BTN_GHOST} w-full !py-3.5 !text-lg`} disabled={busy || joinCode.length < 6}>
                შეერთება →
              </button>
            </form>
          </section>

          {error && (
            <p role="alert" className="text-base text-red-300 lg:col-span-2">
              {error}
            </p>
          )}
        </div>
      )}
    </PageShell>
  );
}
