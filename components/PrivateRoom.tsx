"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { DEFAULT_RULES, type Rules } from "@/lib/joker/rules";
import { cleanCode, createTable, joinTable } from "@/lib/online/client";
import { getSupabase } from "@/lib/supabase";
import { PageShell } from "./PageShell";
import { LABEL, RulesAccordion, RulesForm } from "./RulesForm";
import { BTN_GHOST, BTN_PRIMARY, INPUT, rise } from "./ui";

/** A private table for friends: pick the rules and share the code, or enter a friend's code. Nothing is rated. */
export function PrivateRoom() {
  const router = useRouter();
  const { configured, loading, user } = useAuth();
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Rules>) => setRules((r) => ({ ...r, ...patch }));

  const create = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { table, error: err } = await createTable(supabase, rules);
    if (err || !table) {
      setError(err ?? "მაგიდა ვერ შეიქმნა");
      setBusy(false);
      return;
    }
    router.push(`/joker/table/${table.code}`);
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
    router.push(`/joker/table/${table.code}`);
  };

  return (
    <PageShell width="max-w-3xl">
      <section className="flex flex-col gap-2" style={rise(1)}>
        <p className="text-sm font-bold uppercase tracking-wider text-white/45">ჯოკერი</p>
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">კერძო მაგიდა</h1>
        <p className="text-lg text-white/55 sm:text-xl">თამაში მეგობრებთან კოდით: ქულა და ისტორია არ იწერება</p>
      </section>

      {!configured ? (
        <p className="text-white/55">ონლაინ თამაში ჯერ არ არის ჩართული.</p>
      ) : loading ? null : !user ? (
        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6" style={rise(2)}>
          <p className="text-lg text-white/70">მაგიდისთვის საჭიროა ანგარიში, რომ მეგობრებმა თქვენი სახელი დაინახონ.</p>
          <Link href="/login?next=/joker/private" className={`${BTN_PRIMARY} w-fit`}>
            შესვლა
          </Link>
        </div>
      ) : (
        <>
          <div style={rise(2)}>
            <RulesForm rules={rules} onChange={set} />
          </div>

          <div className="flex flex-col gap-6 pb-8" style={rise(3)}>
            <button className={`${BTN_PRIMARY} w-full !py-4 !text-xl`} onClick={create} disabled={busy}>
              {busy ? "ერთი წამით…" : "მაგიდის შექმნა →"}
            </button>
            <p className="-mt-3 text-sm text-white/40">
              მიიღებთ კოდს, რომელსაც მეგობრებს გაუგზავნით. ოთხივე რომ დაჯდება, თამაში დაიწყება.
            </p>

            <form onSubmit={join} className="flex flex-col gap-3">
              <span className={LABEL}>ან შეუერთდით კოდით</span>
              <div className="flex gap-3">
                <input
                  className={`${INPUT} flex-1 text-center !text-2xl font-extrabold uppercase tracking-[0.4em]`}
                  value={joinCode}
                  onChange={(e) => setJoinCode(cleanCode(e.target.value))}
                  placeholder="ABC123"
                  aria-label="მაგიდის კოდი"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={6}
                />
                <button className={`${BTN_GHOST} !px-7 !text-lg`} disabled={busy || joinCode.length < 6}>
                  შეერთება
                </button>
              </div>
            </form>
            {error && (
              <p role="alert" className="text-base text-red-300">
                {error}
              </p>
            )}
            <RulesAccordion />
          </div>
        </>
      )}
    </PageShell>
  );
}
