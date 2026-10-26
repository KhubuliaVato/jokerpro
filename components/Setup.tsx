"use client";

import { useState } from "react";
import type { Card } from "@/lib/joker/cards";
import { DEFAULT_RULES, type Rules } from "@/lib/joker/rules";
import { CardView } from "./CardView";

const HERO: { card: Card; angle: number; x: number }[] = [
  { card: { joker: false, suit: "S", rank: 14, id: "S14" }, angle: -16, x: -3.4 },
  { card: { joker: true, id: "J0" }, angle: 0, x: 0 },
  { card: { joker: false, suit: "H", rank: 13, id: "H13" }, angle: 16, x: 3.4 },
];

const FORMATS = [
  { value: "full", big: "24", title: "სრული თამაში", hint: "4 პულკა: 1–8, 9×4, 8–1, 9×4" },
  { value: "nine", big: "16", title: "ცხრაკარტიანი", hint: "ყველა ხელი 9 კარტით" },
] as const;

export function Setup({
  onStart,
  kicked,
}: {
  onStart: (rules: Rules) => void;
  kicked?: boolean;
}) {
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const set = (patch: Partial<Rules>) => setRules((r) => ({ ...r, ...patch }));

  return (
    <main className="felt relative min-h-dvh overflow-hidden px-4 py-8 sm:py-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_50%_0%,rgb(232_196_106/0.22),transparent_70%)]" />

      <div className="relative mx-auto flex w-full max-w-lg flex-col gap-6">
        <header className="flex flex-col items-center text-center">
          <div className="relative mb-2 h-36 w-56 sm:h-44">
            {HERO.map(({ card, angle, x }, i) => (
              <div
                key={card.id}
                className="absolute bottom-0 left-1/2 origin-bottom transition-transform duration-300 hover:-translate-y-3"
                style={{
                  transform: `translateX(calc(-50% + ${x}rem)) rotate(${angle}deg)`,
                  zIndex: i === 1 ? 2 : 1,
                }}
              >
                <CardView
                  card={card}
                  style={{ ["--cw" as string]: "5.2rem" } as React.CSSProperties}
                />
              </div>
            ))}
          </div>
          <h1 className="bg-gradient-to-b from-amber-100 to-amber-400 bg-clip-text text-5xl font-extrabold tracking-wide text-transparent drop-shadow sm:text-6xl">
            ჯოკერი
          </h1>
          <p className="mt-2 text-sm opacity-75 sm:text-base">ქართული კარტის თამაში ბოტებთან</p>
        </header>

        {kicked && (
          <div
            role="alert"
            className="rounded-2xl border border-red-400/50 bg-red-500/15 p-3 text-center text-sm text-red-100"
          >
            ზედიზედ ორჯერ გამოტოვეთ სვლა და თამაშიდან გაგაგდეთ.
          </div>
        )}

        <section className="panel flex flex-col gap-5 p-4 sm:p-5">
          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-200/80">
              თამაშის სიგრძე
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {FORMATS.map((f) => {
                const on = rules.format === f.value;
                return (
                  <label
                    key={f.value}
                    className={`group relative flex cursor-pointer flex-col items-center gap-0.5 rounded-2xl border p-3 text-center transition ${
                      on
                        ? "border-amber-300 bg-amber-300/15 shadow-[0_0_18px_rgb(232_196_106/0.25)]"
                        : "border-white/15 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <input
                      type="radio"
                      name="format"
                      className="sr-only"
                      checked={on}
                      onChange={() => set({ format: f.value })}
                    />
                    <span className={`text-4xl font-extrabold leading-none ${on ? "text-amber-300" : ""}`}>
                      {f.big}
                    </span>
                    <span className="text-[0.7rem] opacity-60">ხელი</span>
                    <b className="mt-1 text-sm">{f.title}</b>
                    <span className="text-[0.7rem] leading-snug opacity-65">{f.hint}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-200/80">
              ხიშტის ჯარიმა
            </legend>
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-black/30 p-1">
              {[100, 200, 500].map((v) => {
                const on = rules.khishti === v;
                return (
                  <label
                    key={v}
                    className={`cursor-pointer rounded-xl py-2 text-center text-base font-extrabold tabular-nums transition ${
                      on ? "bg-red-400/90 text-black shadow" : "hover:bg-white/10"
                    }`}
                  >
                    <input
                      type="radio"
                      name="khishti"
                      className="sr-only"
                      checked={on}
                      onChange={() => set({ khishti: v })}
                    />
                    −{v}
                  </label>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs opacity-60">როცა დაკვეთა ≥ 1 იყო და ერთი ხელიც ვერ აიღე</p>
          </fieldset>

          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span>
              <b className="block text-sm">პულკის პრემია</b>
              <span className="text-xs opacity-60">
                ყველა ხელი ზუსტად → საუკეთესო ხელი ერთხელ კიდევ
              </span>
            </span>
            <span className="relative flex-none">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={rules.pulkaPremium}
                onChange={(e) => set({ pulkaPremium: e.target.checked })}
              />
              <span className="block h-7 w-12 rounded-full bg-white/20 transition peer-checked:bg-emerald-400 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-300" />
              <span className="absolute left-1 top-1 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
            </span>
          </label>
        </section>

        <button
          className="rounded-2xl bg-gradient-to-b from-amber-200 to-amber-400 py-4 text-xl font-extrabold text-amber-950 shadow-[0_6px_24px_rgb(232_196_106/0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgb(232_196_106/0.5)] active:translate-y-0 active:scale-[0.99]"
          onClick={() => onStart(rules)}
        >
          თამაშის დაწყება ▶
        </button>

        <details className="panel group p-4 text-sm leading-relaxed">
          <summary className="flex cursor-pointer list-none items-center justify-between font-bold">
            წესები მოკლედ
            <span className="text-amber-300 transition-transform group-open:rotate-180">▾</span>
          </summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 opacity-90">
            <li>4 მოთამაშე, 36 კარტი: შავი ექვსიანების ადგილას 2 ჯოკერია.</li>
            <li>
              1–8 კარტიან ხელში კოზირი გახსნილი კარტის ბუნებაა (ჯოკერი — უკოზიროდ).
              9 კარტიანში პირველი ხელის დამწყები მოთამაშე პირველი 3 კარტით ასახელებს კოზირს.
            </li>
            <li>
              თითოეული ამბობს, რამდენ ხელს აიღებს. ბოლო დამკვეთს არ შეუძლია ისეთი რიცხვის
              თქმა, რომ ჯამი კარტების რაოდენობას გაუტოლდეს.
            </li>
            <li>
              მასტი სავალდებულოა; მასტის გარეშე კოზირი უნდა დადო; ჯოკერის დადება
              ყოველთვის შეიძლება.
            </li>
            <li>
              <b>მოჯოკვრა</b> — ჯოკერი ყველაფერს იღებს. <b>გატანება</b> — ჯოკერი ხელს არ იღებს.
              ჯოკრით შესვლისას მასტს ასახელებ (მოჯოკვრაზე სხვებმა ამ მასტის უმაღლესი უნდა
              დადონ).
            </li>
            <li>
              ქულები: ზუსტი დაკვეთა (დაკვეთა+1)×50; ყველა ხელზე დაკვეთა ×100; პასი 50;
              ჩავარდნა 10 თითო ხელზე; ხიშტი — ჯარიმა.
            </li>
            <li>თითო სვლაზე 40 წამია; ზედიზედ ორჯერ გამოტოვებაზე თამაშიდან გაგაგდებთ.</li>
          </ul>
        </details>
      </div>
    </main>
  );
}
