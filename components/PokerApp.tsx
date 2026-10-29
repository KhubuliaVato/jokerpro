"use client";

import { useState } from "react";
import { botById } from "@/lib/joker/botProfiles";
import type { PokerConfig } from "@/lib/poker/engine";
import { CATEGORY_NAME } from "@/lib/poker/eval";
import { usePokerGame } from "@/lib/poker/usePokerGame";
import { BotPicker } from "./BotPicker";
import { useMe } from "./names";
import { PageShell } from "./PageShell";
import { PokerTable } from "./PokerTable";
import { LABEL } from "./RulesForm";
import { BTN_PRIMARY, rise } from "./ui";

const STAKES: { id: string; title: string; small: number; big: number; stack: number }[] = [
  { id: "low", title: "მცირე", small: 5, big: 10, stack: 500 },
  { id: "mid", title: "საშუალო", small: 10, big: 20, stack: 1000 },
  { id: "high", title: "დიდი", small: 25, big: 50, stack: 2500 },
];

const PLAYER_COUNTS = [2, 3, 4, 5, 6];

/** A game of Texas Hold'em against bots: play chips only, nothing is rated and nothing is recorded anywhere. */
export function PokerApp() {
  const { game, bots, secondsLeft, kicked, start, quit, next, play } = usePokerGame();
  const me = useMe();
  const [players, setPlayers] = useState(6);
  const [stakes, setStakes] = useState("mid");
  const [picked, setPicked] = useState<string[]>(["levani", "nino", "mariami", "dato", "nika"]);
  const opponents = picked.slice(0, players - 1);

  if (game) {
    return <PokerTable game={game} opponents={bots} me={me} secondsLeft={secondsLeft} onPlay={play} onNext={next} onQuit={quit} />;
  }

  const st = STAKES.find((s) => s.id === stakes) ?? STAKES[1];
  const config: PokerConfig = { smallBlind: st.small, bigBlind: st.big, startStack: st.stack, players };

  return (
    <PageShell width="max-w-3xl">
      <section className="flex flex-col gap-2" style={rise(1)}>
        <p className="text-sm font-bold uppercase tracking-wider text-white/45">პოკერი · Texas Hold&apos;em</p>
        <h1 className="text-[clamp(1.8rem,11.5vw,3rem)] font-extrabold tracking-tight sm:text-7xl">ბოტებთან</h1>
        <p className="text-lg text-white/55 sm:text-xl">სათამაშო ჩიპებით: ფული არ გამოიყენება და არაფერი იწერება</p>
      </section>

      {kicked && (
        <p role="alert" className="rounded-2xl border border-red-400/40 bg-red-500/10 px-5 py-4 text-red-200" style={rise(1)}>
          ზედიზედ ორჯერ გამოტოვეთ სვლა და თამაშიდან გაგაგდეთ.
        </p>
      )}

      <div className="flex flex-col gap-10" style={rise(2)}>
        <fieldset>
          <legend className={LABEL}>მოთამაშეები მაგიდასთან</legend>
          <div className="flex flex-wrap gap-3">
            {PLAYER_COUNTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setPlayers(c)}
                aria-pressed={players === c}
                className={`size-14 rounded-2xl border text-xl font-extrabold transition-colors ${
                  players === c ? "border-amber-300 bg-amber-300 text-black" : "border-white/15 text-white/70 hover:border-white/40"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>

        <BotPicker selected={opponents} count={players - 1} onChange={(ids) => setPicked(ids)} />

        <fieldset>
          <legend className={LABEL}>ბლაინდები</legend>
          <div className="grid grid-cols-3 gap-3">
            {STAKES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStakes(s.id)}
                aria-pressed={stakes === s.id}
                className={`rounded-2xl border px-3 py-4 text-center transition-colors ${
                  stakes === s.id ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-white/[0.03] hover:border-white/30"
                }`}
              >
                <b className={`block text-lg ${stakes === s.id ? "text-amber-300" : ""}`}>{s.title}</b>
                <span className="mt-1 block text-xs text-white/55">
                  {s.small}/{s.big}
                </span>
                <span className="block text-xs text-white/40">{s.stack} ჩიპი</span>
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex flex-col gap-6 pb-8" style={rise(3)}>
        <button
          className={`${BTN_PRIMARY} w-full !py-4 !text-xl`}
          disabled={opponents.length !== players - 1}
          onClick={() => start(config, opponents.map(botById))}
        >
          {opponents.length === players - 1 ? "თამაშის დაწყება →" : `აირჩიეთ ${players - 1} ოპონენტი`}
        </button>
        <RulesPanel />
      </div>
    </PageShell>
  );
}

/** The rules of Texas Hold'em in brief. */
function RulesPanel() {
  const [open, setOpen] = useState(false);
  const rankings = [...CATEGORY_NAME].reverse();
  const examples = [
    "ერთი მასტის ხუთი თანმიმდევრული კარტი (10-J-Q-K-A არის როიალ-ფლეში)",
    "ოთხი ერთნაირი ნომინალი",
    "სამი ერთი ნომინალის კარტი და ორი მეორისა",
    "ერთი მასტის ხუთი კარტი, თანმიმდევრობის გარეშე",
    "ხუთი თანმიმდევრული კარტი (A შეიძლება იყოს უმცროსი: A-2-3-4-5)",
    "სამი ერთი ნომინალის კარტი",
    "ორი სხვადასხვა წყვილი",
    "ერთი წყვილი",
    "არაფერი: მოგებს უმაღლესი კარტი",
  ];
  const rules = [
    "თითოეულ მოთამაშეს ორი დახურული კარტი (hole cards) ერგება, მაგიდაზე კი ბოლოს ხუთი საერთო კარტი გაიშლება. ხელს ქმნით თქვენი ორი და მაგიდის ხუთი კარტიდან საუკეთესო ხუთით.",
    "ბლაინდები: დილერის შემდეგი მოთამაშე პატარა ბლაინდს (SB) დებს, მომდევნო დიდ ბლაინდს (BB). D ღილაკი ყოველ ხელზე ერთი ადგილით მარცხნივ გადადის. ორ მოთამაშეზე დილერი პატარა ბლაინდია.",
    "ოთხი ფსონის რაუნდია: პრეფლოპი (საერთო კარტების გარეშე), ფლოპი (3 კარტი), ტერნი (მეოთხე კარტი) და რივერი (მეხუთე).",
    "თქვენს ჯერზე შეგიძლიათ: ფოლდი (გადაყრა), ჩეკი (როცა ფსონი არ არის), ქოლი (გატოლება) ან ბეთი/რეიზი (გაზრდა).",
    "No-limit: ფსონი შეგიძლიათ დადოთ ნებისმიერი ზომის, ბოლო ფსონის ან რეიზის ტოლზე ნაკლებს ვერა (მინიმალური რეიზი ბოლო რეიზის ტოლია), და ყველა ჩიპამდე, ოლ-ინ.",
    "თუ ყველა სხვამ გადაყარა, ბანკს ბოლო მოთამაშე იღებს კარტების ჩვენების გარეშე. წინააღმდეგ შემთხვევაში რივერის შემდეგ ხელები ჩანს და საუკეთესო ხუთკარტიანი ხელი იღებს ბანკს; ტოლობისას ბანკი იყოფა.",
    "ოლ-ინში მყოფი თითოეული მოწინააღმდეგისგან მხოლოდ იმდენს მოიგებთ, რამდენიც თქვენ დადეთ: მეტი ფსონი ცალკე, გვერდით ბანკში მიდის.",
    "თითო სვლაზე 40 წამია; ზედიზედ ორჯერ გამოტოვებაზე თამაშიდან გაგაგდებთ.",
  ];
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03]">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left text-lg font-bold">
        პოკერის წესები მოკლედ
        <span className={`text-2xl text-white/40 transition-transform duration-300 ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="flex flex-col gap-6 px-6 pb-6 text-white/70">
            <div>
              <h3 className="mb-2 font-bold text-amber-300">ხელები, უძლიერესიდან უსუსტესისკენ</h3>
              <ol className="flex flex-col gap-1.5">
                {rankings.map((name, i) => (
                  <li key={name}>
                    <b className="text-white">
                      {i + 1}. {name}
                    </b>{" "}
                    <span className="text-white/55">— {examples[i]}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-sm text-white/50">ტოლი ხელებისას შემდეგ კარტებს ადარებენ (კიკერი): მასტებს რანგი არ აქვს.</p>
            </div>
            <div>
              <h3 className="mb-2 font-bold text-amber-300">თამაში</h3>
              <ul className="flex list-disc flex-col gap-1.5 pl-5">
                {rules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
