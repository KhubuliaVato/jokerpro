"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import type { Rules } from "@/lib/joker/rules";
import { FORMAT_ART, FormatFan } from "./FormatArt";

const RULES: [string, string, string][] = [
  [
    "4 მოთამაშე, 36 კარტი: შავი ექვსიანების ადგილას 2 ჯოკერია.",
    "4 players, 36 cards: the two black sixes are replaced by 2 jokers.",
    "4 игрока, 36 карт: вместо чёрных шестёрок — 2 джокера.",
  ],
  [
    "1–8 კარტიან ხელში კოზირი გახსნილი კარტის ბუნებაა (ჯოკერი — კოზირის გარეშე). 9 კარტიანში პირველი ხელის დამწყები მოთამაშე პირველი 3 კარტით ასახელებს კოზირს.",
    "In hands of 1–8 cards the trump is the suit of the card turned up (a joker means no trump). In the 9-card hand the player who starts names the trump after seeing their first 3 cards.",
    "В раздачах по 1–8 карт козырь — масть открытой карты (джокер — без козыря). В раздаче по 9 карт начинающий игрок называет козырь по первым 3 картам.",
  ],
  [
    "თითოეული ამბობს, რამდენ ხელს აიღებს. ბოლო დამკვეთს არ შეუძლია ისეთი რიცხვის თქმა, რომ ჯამი კარტების რაოდენობას გაუტოლდეს.",
    "Everyone bids how many tricks they will take. The last bidder cannot name a number that makes the total equal the number of cards.",
    "Каждый заказывает, сколько взяток возьмёт. Последний не может назвать число, при котором сумма заказов равна числу карт.",
  ],
  [
    "მასტი სავალდებულოა; მასტის გარეშე კოზირი უნდა დადო; ჯოკერის დადება ყოველთვის შეიძლება.",
    "You must follow suit; without the suit you must play a trump; a joker can always be played.",
    "Нужно ходить в масть; нет масти — кладите козырь; джокера можно класть всегда.",
  ],
  [
    "მოჯოკვრა — ჯოკერი ყველაფერს იღებს. გატანება — ჯოკერი ხელს არ იღებს. ჯოკრით შესვლისას მასტს ასახელებ (მოჯოკვრაზე სხვებმა ამ მასტის უმაღლესი უნდა დადონ).",
    "Mojokvra: the joker takes everything. Gatana: the joker takes nothing. When you lead with a joker you name a suit (for mojokvra the others must play their highest card of that suit).",
    "Моджокра — джокер забирает всё. Гатана — джокер ничего не берёт. Заходя джокером, вы называете масть (при моджокре остальные кладут старшую карту этой масти).",
  ],
  [
    "ქულები: ზუსტი დაკვეთა (დაკვეთა+1)×50; ყველა ხელზე დაკვეთა ×100; პასი 50; ჩავარდნა 10 თითო ხელზე; ხიშტი — ჯარიმა.",
    "Scoring: an exact bid (bid+1)×50; a bid on every trick ×100; pass 50; a miss costs 10 per trick; khishti is a penalty.",
    "Очки: точный заказ (заказ+1)×50; заказ на все взятки ×100; пас 50; недобор — 10 за взятку; хишти — штраф.",
  ],
  [
    "თითო სვლაზე 40 წამია; ზედიზედ ორჯერ გამოტოვებაზე თამაშიდან გაგაგდებთ.",
    "You have 40 seconds per move; missing two in a row removes you from the game.",
    "На ход даётся 40 секунд; два пропуска подряд — и вас исключат из игры.",
  ],
];

export const LABEL = "mb-3 text-sm font-bold uppercase tracking-wider text-white/45";

/** Game length and the penalty for a khishti: the settings of a free-form game. */
export function RulesForm({ rules, onChange }: { rules: Rules; onChange: (patch: Partial<Rules>) => void }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-10">
      <fieldset>
        <legend className={LABEL}>{t("თამაში", "Game", "Игра")}</legend>
        <div className="grid grid-cols-2 gap-4">
          {(["nine", "full"] as const).map((value) => {
            const on = rules.format === value;
            return (
              <label
                key={value}
                className={`group relative flex cursor-pointer flex-col justify-between gap-5 overflow-hidden rounded-3xl border px-2 pb-5 pt-7 text-center min-[360px]:px-4 transition-[border-color,background-color,translate] duration-200 hover:-translate-y-0.5 ${
                  on ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-white/[0.03] hover:border-white/30"
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  className="peer sr-only"
                  checked={on}
                  onChange={() => onChange({ format: value })}
                />
                <span className="absolute inset-0 rounded-3xl peer-focus-visible:ring-2 peer-focus-visible:ring-amber-300" />
                <FormatFan format={value} cardWidth="clamp(2.2rem, 8vw, 4.2rem)" className="h-32" />
                <b className={`relative text-[clamp(0.9rem,4.4vw,1.25rem)] sm:text-2xl ${on ? "text-amber-300" : ""}`}>{FORMAT_ART[value].title}</b>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className={LABEL}>{t("ხიშტი", "Khishti", "Хишти")}</legend>
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
      </fieldset>
    </div>
  );
}

/** "Rules in brief", opening smoothly. */
export function RulesAccordion() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-6 py-5 text-left text-lg font-bold"
      >
        {t("წესები მოკლედ", "Rules in brief", "Правила кратко")}
        <span className={`text-white/40 transition-transform duration-300 ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <ul className="flex flex-col gap-3 border-t border-white/10 px-6 py-5 leading-relaxed text-white/75">
            {RULES.map((rule) => (
              <li key={rule[0]} className="flex gap-3">
                <span className="mt-2.5 size-1.5 flex-none rounded-full bg-amber-300" />
                <span>{t(...rule)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
