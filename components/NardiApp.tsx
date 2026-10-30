"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { botById } from "@/lib/joker/botProfiles";
import { legalSteps, needsRoll, other, pips, winPoints, type NardiState } from "@/lib/nardi/engine";
import { HUMAN, useNardiGame } from "@/lib/nardi/useGame";
import { Avatar } from "./Avatar";
import { BotPicker } from "./BotPicker";
import { NardiBoard } from "./NardiBoard";
import { PageShell } from "./PageShell";
import { BTN_GHOST, BTN_PRIMARY, rise } from "./ui";

const PIPS: Record<number, number[][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
};

function Die({ value, used, dark }: { value: number; used: boolean; dark: boolean }) {
  return (
    <svg
      viewBox="0 0 36 36"
      className={`size-11 drop-shadow-[0_4px_6px_rgb(0_0_0/0.45)] transition-opacity duration-300 sm:size-14 ${used ? "opacity-35" : ""}`}
      aria-label={String(value)}
    >
      <rect x="1.5" y="1.5" width="33" height="33" rx="8" fill={dark ? "#26262c" : "#fbf8ef"} stroke={dark ? "#555" : "#bbb2a0"} strokeWidth="1.5" />
      {PIPS[value].map(([r, c]) => (
        <circle key={`${r}${c}`} cx={9 + c * 9} cy={9 + r * 9} r="3.1" fill={dark ? "#f5efe0" : "#1d1d24"} />
      ))}
    </svg>
  );
}

/** The dice of the current roll; the ones already played are dimmed. */
function Dice({ game }: { game: NardiState }) {
  if (game.rolled.length === 0) return null;
  const double = game.rolled[0] === game.rolled[1];
  // who rolled: the player to move while dice remain, otherwise the one who just finished
  const roller = game.dice.length > 0 ? game.turn : other(game.turn);
  const dark = roller === 1;
  const list = double ? [game.rolled[0], game.rolled[0], game.rolled[0], game.rolled[0]] : game.rolled;
  const unused = game.dice.length;
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {list.map((v, i) => (
        <Die key={i} value={v} dark={dark} used={double ? i >= unused : !game.dice.includes(v)} />
      ))}
    </div>
  );
}

function PlayerBar({
  name,
  avatar,
  off,
  pip,
  active,
}: {
  name: string;
  avatar: { color: string; icon: string };
  off: number;
  pip: number;
  active: boolean;
}) {
  const t = useT();
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-3 py-2 transition-colors ${active ? "border-amber-300/70 bg-amber-300/10" : "border-white/10 bg-white/[0.04]"}`}>
      <Avatar size="sm" color={avatar.color} icon={avatar.icon} />
      <b className="min-w-0 flex-1 truncate text-lg">{name}</b>
      <span className="text-sm text-white/60" title={t("დარჩენილი სვლები", "Pips left", "Осталось очков")}>
        {t("ქულა", "Pips", "Очки")} <b className="text-white">{pip}</b>
      </span>
      <span className="text-sm text-white/60">
        {t("გამოტანილი", "Off", "Снято")} <b className="text-white">{off}/15</b>
      </span>
    </div>
  );
}

/** Nardi (backgammon) against a bot: nothing is rated and nothing is recorded anywhere. */
export function NardiApp() {
  const { game, bot, last, start, quit, rollHuman, move } = useNardiGame();
  const t = useT();
  const [picked, setPicked] = useState<string[]>(["levani"]);
  const [selectedRaw, setSelected] = useState<number | null>(null);

  const myTurn = !!game && game.winner === null && game.turn === HUMAN;
  const steps = useMemo(() => (game && myTurn && game.dice.length > 0 ? legalSteps(game) : []), [game, myTurn]);
  const selected = selectedRaw !== null && steps.some((s) => s.from === selectedRaw) ? selectedRaw : null;

  if (game && bot) {
    const botAvatar = { color: bot.color, icon: bot.icon };
    const you = t("თქვენ", "You", "Вы");
    const canRoll = myTurn && needsRoll(game);
    const status = game.winner !== null
      ? ""
      : myTurn
        ? canRoll
          ? t("თქვენი სვლაა: დაყარეთ კამათლები", "Your turn: roll the dice", "Ваш ход: бросьте кости")
          : selected !== null
            ? t("აირჩიეთ მწვანე პუნქტი", "Tap a green point", "Выберите зелёный пункт")
            : t("აირჩიეთ ჩეკერი", "Pick a checker", "Выберите шашку")
        : t(`${bot.name} ფიქრობს…`, `${bot.name} is thinking…`, `${bot.name} думает…`);
    const passed = game.passed === null ? null : game.passed === HUMAN ? you : bot.name;

    return (
      <main className="relative flex h-dvh flex-col gap-2 overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,#1b6b46,#0a2a1b_78%)] px-3 py-3 text-white select-none sm:gap-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-[44rem] items-center justify-between gap-3">
          <button
            type="button"
            className={BTN_GHOST}
            onClick={() => {
              if (game.winner !== null || window.confirm(t("დარწმუნებული ხართ? თამაში დასრულდება.", "Are you sure? The game will end.", "Вы уверены? Игра закончится."))) quit();
            }}
          >
            ← {t("გასვლა", "Leave", "Выйти")}
          </button>
          <span className="text-sm font-bold uppercase tracking-wider text-white/50">{t("ნარდი", "Nardi", "Нарды")}</span>
        </div>

        <div className="mx-auto flex min-h-0 w-full max-w-[44rem] flex-1 flex-col gap-2">
          <PlayerBar name={bot.name} avatar={botAvatar} off={game.off[1]} pip={pips(game, 1)} active={game.turn === 1 && game.winner === null} />

          <div className="relative min-h-0 flex-1">
            <div className="grid size-full place-items-center">
              <div className="h-full w-full [&>svg]:mx-auto [&>svg]:h-full [&>svg]:w-auto [&>svg]:max-w-full">
                <NardiBoard game={game} steps={steps} selected={selected} onSelect={setSelected} onMove={(s) => { setSelected(null); move(s); }} lastStep={last} />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
              <div className="pointer-events-auto flex flex-col items-center gap-2">
                {canRoll ? (
                  <button className={`${BTN_PRIMARY} animate-pulse !px-7 !py-3`} onClick={rollHuman}>
                    🎲 {t("დაყრა", "Roll", "Бросить")}
                  </button>
                ) : (
                  <Dice game={game} />
                )}
              </div>
            </div>
          </div>

          <PlayerBar name={you} avatar={{ color: "amber", icon: "♛" }} off={game.off[0]} pip={pips(game, 0)} active={myTurn} />
          <p className="min-h-6 text-center text-base text-white/70" aria-live="polite">
            {passed ? t(`${passed}: სვლა არ აქვს`, `${passed}: no move possible`, `${passed}: ходов нет`) + " · " : ""}
            {status}
          </p>
        </div>

        {game.winner !== null && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-black/60 p-5">
            <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-[2rem] border border-white/15 bg-[#0d3322] p-7 text-center shadow-2xl">
              <h2 className="text-4xl font-extrabold text-amber-300">{game.winner === HUMAN ? t("გამარჯვება!", "Victory!", "Победа!") : t("დამარცხება", "Defeat", "Поражение")}</h2>
              <p className="text-lg text-white/70">
                {winPoints(game) === 3
                  ? t("კოქსი: ჩეკერი ბარზე ან თქვენს სახლში დარჩა (3 ქულა)", "Kox: a checker is stuck on the bar or in the winner's home (3 points)", "Кокс: шашка осталась на баре или в доме победителя (3 очка)")
                  : winPoints(game) === 2
                  ? game.winner === HUMAN
                    ? t("მარსი: მეტოქემ ერთი ჩეკერიც ვერ გამოიტანა (2 ქულა)", "Mars: the opponent bore off nothing (2 points)", "Марс: соперник не снял ни одной шашки (2 очка)")
                    : t("მარსი: თქვენ ერთი ჩეკერიც ვერ გამოიტანეთ (2 ქულა)", "Mars: you bore off nothing (2 points)", "Марс: вы не сняли ни одной шашки (2 очка)")
                  : t("ჩვეულებრივი მოგება (1 ქულა)", "A regular win (1 point)", "Обычная победа (1 очко)")}
              </p>
              <div className="flex w-full flex-col gap-2">
                <button className={BTN_PRIMARY} onClick={() => start(bot)}>
                  {t("ახალი თამაში", "Play again", "Играть снова")}
                </button>
                <button className={BTN_GHOST} onClick={quit}>
                  {t("მთავარი მენიუ", "Main menu", "Главное меню")}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  const rules: [string, string, string][] = [
    ["თითოეულს 15 ჩეკერი აქვს. ჩეკერები მოძრაობენ ერთმანეთის საპირისპირო მიმართულებით და ბოლოს თქვენს სახლში (ქვედა მარჯვენა მეოთხედი) შედიან.", "Each side has 15 checkers. The two sides travel in opposite directions round the board and finish in their home board (for you, the bottom right).", "У каждого 15 шашек. Стороны идут навстречу друг другу и заканчивают в своём доме (у вас правая нижняя четверть)."],
    ["ყრით ორ კამათელს და თითო კამათლის რიცხვით ერთ ჩეკერს ათამაშებთ (ან ორივეთი ერთს). დუბლზე (ორი ერთნაირი) 4 სვლა გაქვთ.", "Roll two dice and move a checker by each number (or one checker by both). A double gives you four moves.", "Бросаете две кости и ходите шашкой на каждое число (или одной на оба). Дубль даёт четыре хода."],
    ["პუნქტზე, სადაც მეტოქის 2 ან მეტი ჩეკერია, დადგომა არ შეიძლება. თუ იქ მხოლოდ ერთია, ის „იკვრება“ და ბარზე (შუა ზოლზე) გადადის.", "You cannot land on a point with two or more opposing checkers. If there is only one, it is hit and goes to the bar in the middle.", "Нельзя вставать на пункт, где две и больше шашек соперника. Если там одна, она бьётся и уходит на бар."],
    ["ბარზე მყოფი ჩეკერი ჯერ უნდა დაბრუნდეთ მეტოქის სახლში (კამათლის რიცხვი = პუნქტის ნომერი). თუ ყველა ადგილი დაკეტილია, სვლა გამოგრჩებათ.", "A checker on the bar must come back first, onto the opponent's home board (the die shows the point). If every entry is closed you lose the turn.", "Шашку с бара нужно сначала ввести в дом соперника (число на кости = номер пункта). Если все входы закрыты, ход пропускается."],
    ["თუ ორივე კამათლით თამაში შეიძლება, ორივე უნდა ითამაშოთ. თუ მხოლოდ ერთით, დიდს ითამაშებთ.", "If both dice can be played you must play both. If only one can, you play the larger one.", "Если можно сыграть обе кости, играть нужно обе. Если только одну, то большую."],
    ["როცა ყველა 15 ჩეკერი სახლშია, იწყება გამოტანა. იგებს ის, ვინც პირველი გამოიტანს ყველას. თუ მეტოქეს არცერთი არ გამოუტანია, ეს მარსია (2 ქულა), ხოლო თუ ის ჯერ ბარზე ან თქვენს სახლშია, ეს კოქსია (3 ქულა).", "When all 15 are home you bear off. The first to bear off everything wins. If the opponent has borne off none, it is mars (2 points); if they are still on the bar or in your home board, it is kox (3 points).", "Когда все 15 дома, начинается снятие. Побеждает снявший все первым. Если соперник не снял ни одной, это марс (2 очка); если он ещё на баре или в вашем доме, это кокс (3 очка)."],
  ];

  return (
    <PageShell width="max-w-3xl">
      <section className="flex flex-col gap-2" style={rise(1)}>
        <p className="text-sm font-bold uppercase tracking-wider text-white/45">{t("ნარდი", "Nardi", "Нарды")}</p>
        <h1 className="text-[clamp(1.8rem,11.5vw,3rem)] font-extrabold tracking-tight sm:text-7xl">{t("ნარდი", "Nardi", "Нарды")}</h1>
        <p className="text-lg text-white/55 sm:text-xl">{t("ბოტთან თამაში: ქულა და ისტორია არ იწერება", "Play a bot: points and history are not recorded", "Игра с ботом: очки и история не записываются")}</p>
      </section>

      <div className="flex flex-col gap-8" style={rise(2)}>
        <BotPicker selected={picked} count={1} onChange={setPicked} />
        <details className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <summary className="cursor-pointer text-lg font-bold">{t("წესები", "Rules", "Правила")}</summary>
          <ol className="mt-4 flex list-decimal flex-col gap-3 pl-5 text-white/70">
            {rules.map((r, i) => (
              <li key={i}>{t(...r)}</li>
            ))}
          </ol>
        </details>
      </div>

      <div className="pb-8" style={rise(3)}>
        <button className={`${BTN_PRIMARY} w-full !py-4 !text-xl`} disabled={picked.length !== 1} onClick={() => start(botById(picked[0]))}>
          {picked.length === 1 ? t("თამაშის დაწყება →", "Start the game →", "Начать игру →") : t("აირჩიეთ ოპონენტი", "Choose an opponent", "Выберите соперника")}
        </button>
      </div>
    </PageShell>
  );
}
