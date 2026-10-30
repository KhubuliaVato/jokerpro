"use client";

import { useT } from "@/lib/i18n";
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

const STAKES: { id: string; title: [string, string, string]; small: number; big: number; stack: number }[] = [
  { id: "low", title: ["მცირე", "Low", "Малые"], small: 5, big: 10, stack: 500 },
  { id: "mid", title: ["საშუალო", "Medium", "Средние"], small: 10, big: 20, stack: 1000 },
  { id: "high", title: ["დიდი", "High", "Большие"], small: 25, big: 50, stack: 2500 },
];

const PLAYER_COUNTS = [2, 3, 4, 5, 6];

/** A game of Texas Hold'em against bots: play chips only, nothing is rated and nothing is recorded anywhere. */
export function PokerApp() {
  const { game, bots, secondsLeft, kicked, start, quit, next, play } = usePokerGame();
  const me = useMe();
  const t = useT();
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
        <p className="text-sm font-bold uppercase tracking-wider text-white/45">{t("პოკერი", "Poker", "Покер")} · Texas Hold&apos;em</p>
        <h1 className="text-[clamp(1.8rem,11.5vw,3rem)] font-extrabold tracking-tight sm:text-7xl">{t("ბოტებთან", "Vs bots", "С ботами")}</h1>
        <p className="text-lg text-white/55 sm:text-xl">{t("სათამაშო ჩიპებით: ფული არ გამოიყენება და არაფერი იწერება", "Play chips only: no real money and nothing is recorded", "Игровые фишки: без денег, ничего не записывается")}</p>
      </section>

      {kicked && (
        <p role="alert" className="rounded-2xl border border-red-400/40 bg-red-500/10 px-5 py-4 text-red-200" style={rise(1)}>
          {t("ზედიზედ ორჯერ გამოტოვეთ სვლა და თამაშიდან გაგაგდეთ.", "You missed your turn twice in a row and were removed from the game.", "Вы дважды подряд пропустили ход и были исключены из игры.")}
        </p>
      )}

      <div className="flex flex-col gap-10" style={rise(2)}>
        <fieldset>
          <legend className={LABEL}>{t("მოთამაშეები მაგიდასთან", "Players at the table", "Игроков за столом")}</legend>
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
          <legend className={LABEL}>{t("ბლაინდები", "Blinds", "Блайнды")}</legend>
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
                <b className={`block text-lg ${stakes === s.id ? "text-amber-300" : ""}`}>{t(...s.title)}</b>
                <span className="mt-1 block text-xs text-white/55">
                  {s.small}/{s.big}
                </span>
                <span className="block text-xs text-white/40">{s.stack} {t("ჩიპი", "chips", "фишек")}</span>
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
          {opponents.length === players - 1 ? t("თამაშის დაწყება →", "Start the game →", "Начать игру →") : t(`აირჩიეთ ${players - 1} ოპონენტი`, `Choose ${players - 1} opponent${players - 1 > 1 ? "s" : ""}`, `Выберите соперников: ${players - 1}`)}
        </button>
        <RulesPanel />
      </div>
    </PageShell>
  );
}

/** The rules of Texas Hold'em in brief. */
function RulesPanel() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rankings = [...CATEGORY_NAME].reverse();
  const examples: [string, string, string][] = [
    ["ერთი მასტის ხუთი თანმიმდევრული კარტი (10-J-Q-K-A არის როიალ-ფლეში)", "five consecutive cards of one suit (10-J-Q-K-A is a royal flush)", "пять карт одной масти подряд (10-J-Q-K-A — роял-флеш)"],
    ["ოთხი ერთნაირი ნომინალი", "four cards of the same rank", "четыре карты одного достоинства"],
    ["სამი ერთი ნომინალის კარტი და ორი მეორისა", "three of one rank and two of another", "три карты одного достоинства и две другого"],
    ["ერთი მასტის ხუთი კარტი, თანმიმდევრობის გარეშე", "five cards of one suit, not in sequence", "пять карт одной масти не подряд"],
    ["ხუთი თანმიმდევრული კარტი (A შეიძლება იყოს უმცროსი: A-2-3-4-5)", "five consecutive cards (the ace can be low: A-2-3-4-5)", "пять карт подряд (туз может быть младшим: A-2-3-4-5)"],
    ["სამი ერთი ნომინალის კარტი", "three cards of the same rank", "три карты одного достоинства"],
    ["ორი სხვადასხვა წყვილი", "two different pairs", "две разные пары"],
    ["ერთი წყვილი", "one pair", "одна пара"],
    ["არაფერი: მოგებს უმაღლესი კარტი", "nothing: the highest card wins", "ничего: побеждает старшая карта"],
  ];
  const rules: [string, string, string][] = [
    [
      "თითოეულ მოთამაშეს ორი დახურული კარტი (hole cards) ერგება, მაგიდაზე კი ბოლოს ხუთი საერთო კარტი გაიშლება. ხელს ქმნით თქვენი ორი და მაგიდის ხუთი კარტიდან საუკეთესო ხუთით.",
      "Each player gets two face-down cards (hole cards), and in the end five community cards are laid out on the table. Your hand is the best five of your two cards and the five on the table.",
      "Каждому игроку раздаются две закрытые карты (hole cards), а на стол в итоге выкладываются пять общих. Ваша комбинация — лучшие пять из ваших двух и пяти на столе.",
    ],
    [
      "ბლაინდები: დილერის შემდეგი მოთამაშე პატარა ბლაინდს (SB) დებს, მომდევნო დიდ ბლაინდს (BB). D ღილაკი ყოველ ხელზე ერთი ადგილით მარცხნივ გადადის. ორ მოთამაშეზე დილერი პატარა ბლაინდია.",
      "Blinds: the player after the dealer posts the small blind (SB), the next one the big blind (BB). The D button moves one seat left every hand. With two players the dealer is the small blind.",
      "Блайнды: игрок после дилера ставит малый блайнд (SB), следующий — большой (BB). Кнопка D каждую раздачу сдвигается на одно место влево. Вдвоём дилер ставит малый блайнд.",
    ],
    [
      "ოთხი ფსონის რაუნდია: პრეფლოპი (საერთო კარტების გარეშე), ფლოპი (3 კარტი), ტერნი (მეოთხე კარტი) და რივერი (მეხუთე).",
      "There are four betting rounds: preflop (no community cards), flop (3 cards), turn (4th card) and river (5th).",
      "Четыре круга торговли: префлоп (без общих карт), флоп (3 карты), тёрн (4-я карта) и ривер (5-я).",
    ],
    [
      "თქვენს ჯერზე შეგიძლიათ: ფოლდი (გადაყრა), ჩეკი (როცა ფსონი არ არის), ქოლი (გატოლება) ან ბეთი/რეიზი (გაზრდა).",
      "On your turn you can: fold (give up), check (when there is no bet), call (match the bet) or bet/raise (increase it).",
      "В свой ход можно: фолд (сбросить), чек (когда нет ставки), колл (уравнять) или бет/рейз (повысить).",
    ],
    [
      "No-limit: ფსონი შეგიძლიათ დადოთ ნებისმიერი ზომის, ბოლო ფსონის ან რეიზის ტოლზე ნაკლებს ვერა (მინიმალური რეიზი ბოლო რეიზის ტოლია), და ყველა ჩიპამდე, ოლ-ინ.",
      "No-limit: you can bet any amount, but not less than the last bet or raise (the minimum raise equals the last raise), up to all your chips (all-in).",
      "No-limit: ставить можно любую сумму, но не меньше последней ставки или рейза (минимальный рейз равен последнему), вплоть до всех фишек (олл-ин).",
    ],
    [
      "თუ ყველა სხვამ გადაყარა, ბანკს ბოლო მოთამაშე იღებს კარტების ჩვენების გარეშე. წინააღმდეგ შემთხვევაში რივერის შემდეგ ხელები ჩანს და საუკეთესო ხუთკარტიანი ხელი იღებს ბანკს; ტოლობისას ბანკი იყოფა.",
      "If everyone else folds, the last player takes the pot without showing cards. Otherwise hands are shown after the river and the best five-card hand takes the pot; in a tie the pot is split.",
      "Если все остальные сбросили, банк забирает последний игрок, не показывая карты. Иначе после ривера карты вскрываются, и лучшая пятикарточная комбинация берёт банк; при равенстве банк делится.",
    ],
    [
      "ოლ-ინში მყოფი თითოეული მოწინააღმდეგისგან მხოლოდ იმდენს მოიგებთ, რამდენიც თქვენ დადეთ: მეტი ფსონი ცალკე, გვერდით ბანკში მიდის.",
      "From each all-in opponent you can only win as much as you put in: extra bets go to a separate side pot.",
      "У каждого соперника, ушедшего олл-ин, вы можете выиграть лишь столько, сколько поставили сами: лишние ставки идут в отдельный побочный банк.",
    ],
    [
      "თითო სვლაზე 40 წამია; ზედიზედ ორჯერ გამოტოვებაზე თამაშიდან გაგაგდებთ.",
      "You have 40 seconds per move; missing two in a row removes you from the game.",
      "На ход даётся 40 секунд; два пропуска подряд — и вас исключат из игры.",
    ],
  ];
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03]">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left text-lg font-bold">
        {t("პოკერის წესები მოკლედ", "Poker rules in brief", "Правила покера кратко")}
        <span className={`text-2xl text-white/40 transition-transform duration-300 ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="flex flex-col gap-6 px-6 pb-6 text-white/70">
            <div>
              <h3 className="mb-2 font-bold text-amber-300">{t("ხელები, უძლიერესიდან უსუსტესისკენ", "Hands, from strongest to weakest", "Комбинации от сильнейшей к слабейшей")}</h3>
              <ol className="flex flex-col gap-1.5">
                {rankings.map((name, i) => (
                  <li key={name}>
                    <b className="text-white">
                      {i + 1}. {name}
                    </b>{" "}
                    <span className="text-white/55">— {t(...examples[i])}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-sm text-white/50">{t("ტოლი ხელებისას შემდეგ კარტებს ადარებენ (კიკერი): მასტებს რანგი არ აქვს.", "Equal hands are decided by the next cards (the kicker): suits have no rank.", "При равных комбинациях сравниваются следующие карты (кикер): масти не различаются по старшинству.")}</p>
            </div>
            <div>
              <h3 className="mb-2 font-bold text-amber-300">{t("თამაში", "Play", "Игра")}</h3>
              <ul className="flex list-disc flex-col gap-1.5 pl-5">
                {rules.map((r) => (
                  <li key={r[0]}>{t(...r)}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
