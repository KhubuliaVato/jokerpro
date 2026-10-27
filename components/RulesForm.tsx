"use client";

import { useState } from "react";
import type { Rules } from "@/lib/joker/rules";

export const FORMATS = [
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

export const LABEL = "mb-3 text-sm font-bold uppercase tracking-wider text-white/45";

/** Game length, penalty for a khishti and the stage premium: the settings of a free-form game. */
export function RulesForm({ rules, onChange }: { rules: Rules; onChange: (patch: Partial<Rules>) => void }) {
  return (
    <div className="flex flex-col gap-10">
      <fieldset>
        <legend className={LABEL}>თამაშის სიგრძე</legend>
        <div className="grid grid-cols-2 gap-4">
          {FORMATS.map((f) => {
            const on = rules.format === f.value;
            return (
              <label
                key={f.value}
                className={`relative flex cursor-pointer flex-col items-center gap-1 rounded-3xl border px-4 py-6 text-center transition-[border-color,background-color,translate] duration-200 hover:-translate-y-0.5 ${
                  on ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-white/[0.03] hover:border-white/30"
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  className="peer sr-only"
                  checked={on}
                  onChange={() => onChange({ format: f.value })}
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
                  onChange={() => onChange({ khishti: v })}
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
            onChange={(e) => onChange({ pulkaPremium: e.target.checked })}
          />
          <span className="block h-8 w-14 rounded-full bg-white/15 transition-colors duration-200 peer-checked:bg-emerald-400 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-300" />
          <span className="absolute left-1 top-1 size-6 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-6" />
        </span>
      </label>
    </div>
  );
}

/** "Rules in brief", opening smoothly. */
export function RulesAccordion() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-6 py-5 text-left text-lg font-bold"
      >
        წესები მოკლედ
        <span className={`text-white/40 transition-transform duration-300 ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
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
  );
}
