"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { Card } from "@/lib/joker/cards";
import { cleanCode, createTable, joinTable } from "@/lib/online/client";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_RULES, type Rules } from "@/lib/joker/rules";
import { CardView } from "./CardView";
import { PageShell } from "./PageShell";
import { BTN_GHOST, BTN_PRIMARY, INPUT, rise } from "./ui";

const HERO: { card: Card; angle: number; x: number }[] = [
  { card: { joker: false, suit: "S", rank: 14, id: "S14" }, angle: -14, x: -3.4 },
  { card: { joker: true, id: "J0" }, angle: 0, x: 0 },
  { card: { joker: false, suit: "H", rank: 13, id: "H13" }, angle: 14, x: 3.4 },
];

const FORMATS = [
  { value: "full", big: "24", title: "სრული თამაში", hint: "4 ეტაპი: 1–8, 9×4, 8–1, 9×4" },
  { value: "nine", big: "16", title: "ცხრაკარტიანი", hint: "ყველა ხელი 9 კარტით" },
] as const;

const RULES = [
  "4 მოთამაშე, 36 კარტი: შავი ექვსიანების ადგილას 2 ჯოკერია.",
  "1–8 კარტიან ხელში კოზირი გახსნილი კარტის ბუნებაა (ჯოკერი — უკოზიროდ). 9 კარტიანში პირველი ხელის დამწყები მოთამაშე პირველი 3 კარტით ასახელებს კოზირს.",
  "თითოეული ამბობს, რამდენ ხელს აიღებს. ბოლო დამკვეთს არ შეუძლია ისეთი რიცხვის თქმა, რომ ჯამი კარტების რაოდენობას გაუტოლდეს.",
  "მასტი სავალდებულოა; მასტის გარეშე კოზირი უნდა დადო; ჯოკერის დადება ყოველთვის შეიძლება.",
  "მოჯოკვრა — ჯოკერი ყველაფერს იღებს. გატანება — ჯოკერი ხელს არ იღებს. ჯოკრით შესვლისას მასტს ასახელებ (მოჯოკვრაზე სხვებმა ამ მასტის უმაღლესი უნდა დადონ).",
  "ქულები: ზუსტი დაკვეთა (დაკვეთა+1)×50; ყველა ხელზე დაკვეთა ×100; პასი 50; ჩავარდნა 10 თითო ხელზე; ხიშტი — ჯარიმა.",
  "თითო სვლაზე 40 წამია; ზედიზედ ორჯერ გამოტოვებაზე თამაშიდან გაგაგდებთ.",
];

const LABEL = "mb-3 text-sm font-bold uppercase tracking-wider text-white/45";

export function Setup({
  onStart,
  kicked,
}: {
  onStart: (rules: Rules) => void;
  kicked?: boolean;
}) {
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [rulesOpen, setRulesOpen] = useState(false);
  const router = useRouter();
  const { configured, user } = useAuth();
  const [mode, setMode] = useState<"bots" | "online">("bots");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const set = (patch: Partial<Rules>) => setRules((r) => ({ ...r, ...patch }));

  const createOnline = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true);
    setOnlineError(null);
    const { table, error } = await createTable(supabase, rules);
    if (error || !table) {
      setOnlineError(error ?? "მაგიდა ვერ შეიქმნა");
      setBusy(false);
      return;
    }
    router.push(`/joker/table/${table.code}`);
  };

  const joinOnline = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase || joinCode.length < 6) return;
    setBusy(true);
    setOnlineError(null);
    const { table, error } = await joinTable(supabase, joinCode);
    if (error || !table) {
      setOnlineError(error ?? "მაგიდასთან შეერთება ვერ მოხერხდა");
      setBusy(false);
      return;
    }
    router.push(`/joker/table/${table.code}`);
  };

  return (
    <PageShell width="max-w-3xl">
      <section className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center" style={rise(1)}>
        <div>
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">ჯოკერი</h1>
          <p className="mt-2 text-lg text-white/55 sm:text-xl">ბოტებთან · 4 მოთამაშე</p>
        </div>
        <div className="relative mx-auto h-32 w-48 flex-none sm:mx-0">
          {HERO.map(({ card, angle, x }, i) => (
            <div
              key={card.id}
              className="absolute bottom-0 left-1/2 origin-bottom transition-transform duration-300 hover:-translate-y-3"
              style={{
                transform: `translateX(calc(-50% + ${x * 0.8}rem)) rotate(${angle}deg)`,
                zIndex: i === 1 ? 2 : 1,
              }}
            >
              <CardView card={card} style={{ ["--cw" as string]: "4.2rem" } as React.CSSProperties} />
            </div>
          ))}
        </div>
      </section>

      {kicked && (
        <p
          role="alert"
          className="rounded-2xl border border-red-400/40 bg-red-500/10 px-5 py-4 text-red-200"
          style={rise(1)}
        >
          ზედიზედ ორჯერ გამოტოვეთ სვლა და თამაშიდან გაგაგდეთ.
        </p>
      )}

      <div className="grid grid-cols-2 gap-1.5 rounded-full border border-white/10 bg-white/[0.04] p-1.5" role="tablist" style={rise(2)}>
        {(
          [
            ["bots", "ბოტებთან"],
            ["online", "ონლაინ მეგობრებთან"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`rounded-full py-3 text-base font-bold transition-[background-color,color] duration-200 sm:text-lg ${
              mode === value ? "bg-amber-300 text-black" : "text-white/60 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-10" style={rise(2)}>
        <fieldset>
          <legend className={LABEL}>თამაშის სიგრძე</legend>
          <div className="grid grid-cols-2 gap-4">
            {FORMATS.map((f) => {
              const on = rules.format === f.value;
              return (
                <label
                  key={f.value}
                  className={`relative flex cursor-pointer flex-col items-center gap-1 rounded-3xl border px-4 py-6 text-center transition-[border-color,background-color,translate] duration-200 hover:-translate-y-0.5 ${
                    on
                      ? "border-amber-300 bg-amber-300/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    className="peer sr-only"
                    checked={on}
                    onChange={() => set({ format: f.value })}
                  />
                  <span className="absolute inset-0 rounded-3xl peer-focus-visible:ring-2 peer-focus-visible:ring-amber-300" />
                  <span className={`text-6xl font-extrabold leading-none tabular-nums ${on ? "text-amber-300" : ""}`}>
                    {f.big}
                  </span>
                  <span className="text-sm text-white/45">ხელი</span>
                  <b className="mt-2 text-lg">{f.title}</b>
                  <span className="text-sm leading-snug text-white/45">{f.hint}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className={LABEL}>ხიშტის ჯარიმა</legend>
          <div className="flex gap-3">
            {[100, 200, 500].map((v) => {
              const on = rules.khishti === v;
              return (
                <label
                  key={v}
                  className={`relative flex-1 cursor-pointer rounded-full border py-3 text-center text-xl font-extrabold tabular-nums transition-[border-color,background-color,color] duration-200 ${
                    on
                      ? "border-red-400 bg-red-400 text-black"
                      : "border-white/15 text-white/70 hover:border-white/40 hover:text-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="khishti"
                    className="peer sr-only"
                    checked={on}
                    onChange={() => set({ khishti: v })}
                  />
                  <span className="absolute inset-0 rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-amber-300" />
                  −{v}
                </label>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-white/40">როცა დაკვეთა ≥ 1 იყო და ერთი ხელიც ვერ აიღეთ</p>
        </fieldset>

        <label className="flex cursor-pointer items-center justify-between gap-6 rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-5">
          <span>
            <b className="block text-lg">ეტაპის პრემია</b>
            <span className="text-sm text-white/45">ყველა ხელი ზუსტად → საუკეთესო ხელი ერთხელ კიდევ</span>
          </span>
          <span className="relative flex-none">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={rules.pulkaPremium}
              onChange={(e) => set({ pulkaPremium: e.target.checked })}
            />
            <span className="block h-8 w-14 rounded-full bg-white/15 transition-colors duration-200 peer-checked:bg-emerald-400 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-300" />
            <span className="absolute left-1 top-1 size-6 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-6" />
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-6 pb-8" style={rise(3)}>
        {mode === "bots" ? (
          <button className={`${BTN_PRIMARY} w-full !py-4 !text-xl`} onClick={() => onStart(rules)}>
            თამაშის დაწყება →
          </button>
        ) : !configured ? (
          <p className="text-white/55">ონლაინ თამაში ჯერ არ არის ჩართული.</p>
        ) : !user ? (
          <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-lg text-white/70">ონლაინ მაგიდისთვის საჭიროა ანგარიში, რომ მეგობრებმა თქვენი სახელი დაინახონ.</p>
            <Link href="/login?next=/joker" className={`${BTN_PRIMARY} w-fit`}>
              შესვლა
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <button className={`${BTN_PRIMARY} w-full !py-4 !text-xl`} onClick={createOnline} disabled={busy}>
              {busy ? "ერთი წამით…" : "კერძო მაგიდის შექმნა →"}
            </button>
            <p className="-mt-3 text-sm text-white/40">მიიღებთ კოდს, რომელსაც მეგობრებს გაუგზავნით. ოთხივე რომ დაჯდება, თამაში დაიწყება.</p>

            <form onSubmit={joinOnline} className="flex flex-col gap-3">
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
            {onlineError && (
              <p role="alert" className="text-base text-red-300">
                {onlineError}
              </p>
            )}
          </div>
        )}

        <div className="rounded-3xl border border-white/10 bg-white/[0.03]">
          <button
            type="button"
            onClick={() => setRulesOpen((v) => !v)}
            aria-expanded={rulesOpen}
            className="flex w-full items-center justify-between px-6 py-5 text-left text-lg font-bold"
          >
            წესები მოკლედ
            <span className={`text-white/40 transition-transform duration-300 ${rulesOpen ? "rotate-180" : ""}`}>⌄</span>
          </button>
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-out ${rulesOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
          >
            <div className="overflow-hidden">
              <ul className="flex flex-col gap-3 border-t border-white/10 px-6 py-5 leading-relaxed text-white/75">
                {RULES.map((text) => (
                  <li key={text} className="flex gap-3">
                    <span className="mt-2.5 size-1.5 flex-none rounded-full bg-amber-300" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
