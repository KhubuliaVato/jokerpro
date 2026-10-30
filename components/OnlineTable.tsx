"use client";

import { tt, useLang } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useOnlineTable } from "@/lib/online/useOnlineTable";
import type { Rules } from "@/lib/joker/rules";
import type { BuraState } from "@/lib/bura/engine";
import type { BuraRules } from "@/lib/bura/online";
import type { GameState } from "@/lib/joker/engine";
import type { PokerState } from "@/lib/poker/engine";
import type { PokerRules } from "@/lib/poker/online";
import { Avatar } from "./Avatar";
import { PlayerNamesProvider } from "./names";
import { PageShell } from "./PageShell";
import { QueueLobby } from "./QueueLobby";
import { RatingResult } from "./RatingResult";
import { BuraTable } from "./BuraTable";
import { PokerTable } from "./PokerTable";
import { Table } from "./Table";
import { TableChat } from "./TableChat";
import { BTN_GHOST, BTN_PRIMARY, FORMAT_LABEL, rise } from "./ui";

/** "სრული თამაში · ხიშტი −200" */
export const describeRules = (r: Rules) =>
  `${FORMAT_LABEL[r.format]} · ${tt("ხიშტი", "Khishti", "Хишти")} −${r.format === "nine" ? r.khishti * 2 : `${r.khishti} / −${r.khishti * 2}`}${r.pulkaPremium ? ` · ${tt("ეტაპის პრემია", "round bonus", "премия за этап")}` : ""}`;

/** "2 მოთამაშე" / "4 მოთამაშე · 2×2" */
export const describeBura = (r: BuraRules) => (r.players === 4 ? tt("4 მოთამაშე · 2×2", "4 players · 2×2", "4 игрока · 2×2") : tt("2 მოთამაშე", "2 players", "2 игрока"));

/** "Texas Hold'em · 4 მოთამაშე · ბლაინდები 10/20" */
export const describePoker = (r: PokerRules) => `Texas Hold'em · ${r.players} ${tt("მოთამაშე", "players", "игроков")} · ${tt("ბლაინდები", "blinds", "блайнды")} ${r.smallBlind}/${r.bigBlind} · ${r.startStack} ${tt("ჩიპი", "chips", "фишек")}`;

/** The screen behind a table code: the waiting room first, the game itself once four players sit. */
export function OnlineTable({ code }: { code: string }) {
  useLang(); // the table re-renders when the language is switched
  const router = useRouter();
  const { configured, loading, user } = useAuth();
  const t = useOnlineTable(code);

  const game = t.table?.game ?? "joker";
  const back = () => router.push(`/${game}`);
  const leaveToMenu = async () => {
    await t.leave();
    back();
  };

  if (!configured) return <Message title={tt("ონლაინ თამაში ჯერ არ არის ჩართული", "Online play is not enabled yet", "Онлайн-игра пока не включена")} />;
  if (loading) return <Message title="…" />;
  if (!user) {
    return (
      <Message
        title={tt("ონლაინ მაგიდაზე შესასვლელად შედით ანგარიშში", "Sign in to join an online table", "Войдите, чтобы сесть за онлайн-стол")}
        action={
          <Link href={`/login?next=${encodeURIComponent(`/joker/table/${code}`)}`} className={`${BTN_PRIMARY} w-fit`}>
            {tt("შესვლა", "Sign in", "Войти")}
          </Link>
        }
      />
    );
  }
  if (t.error) {
    return (
      <Message
        title={t.error}
        action={
          <Link href="/joker" className={`${BTN_GHOST} w-fit`}>
            ← {tt("უკან", "Back", "Назад")}
          </Link>
        }
      />
    );
  }
  if (!t.table) return <Message title={tt("მაგიდასთან გამაერთიანებთ…", "Joining the table…", "Подключаем к столу…")} />;

  // My seat was taken over by a bot (I left or timed out twice): I can only watch the end, so show the way out.
  if (t.mySeat?.bot && t.table.status !== "waiting") {
    return (
      <Message
        title={tt("ადგილი ბოტმა დაიკავა", "A bot took your seat", "Ваше место занял бот")}
        text={tt("ზედიზედ ორჯერ გამოტოვეთ სვლა ან მაგიდა დატოვეთ.", "You missed your turn twice in a row or left the table.", "Вы дважды подряд пропустили ход или покинули стол.")}
        action={
          <Link href={`/${game}`} className={`${BTN_GHOST} w-fit`}>
            ← {tt("უკან", "Back", "Назад")}
          </Link>
        }
      />
    );
  }

  // The ready check ran out before I accepted: the seat is gone.
  if (t.kicked) {
    return (
      <Message
        title={tt("დრო ამოიწურა", "Time ran out", "Время истекло")}
        text={tt("მატჩი დროზე არ დაადასტურეთ.", "You did not confirm the match in time.", "Вы не подтвердили матч вовремя.")}
        action={
          <Link href={`/${game}/${t.table.kind}`} className={`${BTN_PRIMARY} w-fit`}>
            {tt("ხელახლა ძებნა", "Search again", "Искать снова")}
          </Link>
        }
      />
    );
  }

  if (t.table.status === "waiting" || !t.view) {
    if (t.table.status === "closed") return <Message title={tt("მაგიდა დაიხურა", "The table was closed", "Стол закрыт")} />;
    // Random-player tables wait in a lobby with four lamps; private ones show the code to share.
    if (t.table.kind !== "private") {
      return (
        <QueueLobby
          kind={t.table.kind}
          rules={t.table.rules as Rules | BuraRules}
          game={game as "joker" | "bura"}
          players={t.players}
          full={t.seats.length === t.capacity}
          readyLeft={t.readyLeft}
          onAccept={() => void t.accept()}
          onLeave={leaveToMenu}
        />
      );
    }
    return (
      <Lobby
        code={t.table.code}
        rules={t.table.rules}
        players={t.players}
        hostId={t.table.host_id}
        myId={user.id}
        starting={t.seats.length === t.capacity}
        game={game}
        onLeave={leaveToMenu}
      />
    );
  }

  if (t.table.game === "poker") {
    const others = t.players.slice(1).map((p) => ({
      name: (p?.profile?.nickname ?? "…") + (p?.bot ? ` · ${tt("ბოტი", "bot", "бот")}` : ""),
      color: p?.profile?.avatar_color,
      icon: p?.profile?.avatar_icon,
      url: p?.profile?.avatar_url ?? null,
    }));
    return (
      <>
        <PokerTable
          game={t.view as PokerState}
          opponents={others}
          me={{
            name: t.players[0]?.profile?.nickname ?? tt("თქვენ", "You", "Вы"),
            avatar: t.players[0]?.profile
              ? { color: t.players[0].profile.avatar_color, icon: t.players[0].profile.avatar_icon, url: t.players[0].profile.avatar_url }
              : null,
          }}
          secondsLeft={t.secondsLeft}
          onPlay={(action) => void t.pokerAct(action)}
          onNext={() => {}}
          autoNext
          onQuit={() => {
            if (window.confirm(tt("დარწმუნებული ხართ? გასვლისას თქვენს ადგილს ბოტი დაიკავებს.", "Are you sure? A bot will take your seat when you leave.", "Вы уверены? После выхода ваше место займёт бот."))) void leaveToMenu();
          }}
        />
        {t.notice && <Notice text={t.notice} />}
      </>
    );
  }

  const names = t.players.map((p, k) => (p?.profile?.nickname ?? (k === 0 ? tt("თქვენ", "You", "Вы") : "…")) + (p?.bot && k !== 0 ? ` · ${tt("ბოტი", "bot", "бот")}` : ""));
  const avatars = t.players.map((p) =>
    p?.profile
      ? { color: p.profile.avatar_color, icon: p.profile.avatar_icon, url: p.profile.avatar_url }
      : null,
  );

  const quitConfirm =
    t.table.kind === "ranked"
      ? tt("დარწმუნებული ხართ? თამაშიდან გასვლა წოდებისთვის ბრძოლაში −10 ქულას ნიშნავს და თქვენს ადგილს ბოტი დაიკავებს.", "Are you sure? Leaving a ranked game costs −10 points and a bot takes your seat.", "Вы уверены? Выход из рейтинговой игры стоит −10 очков, а ваше место займёт бот.")
      : tt("დარწმუნებული ხართ? გასვლისას თქვენს ადგილს ბოტი დაიკავებს.", "Are you sure? A bot will take your seat when you leave.", "Вы уверены? После выхода ваше место займёт бот.");
  const note =
    t.table.kind === "ranked" ? (
      <RatingResult tableId={t.table.id} userId={user.id} />
    ) : t.table.kind === "friendly" ? (
      <span className="text-emerald-300">✓ {tt("თამაში ჩაიწერა ისტორიაში", "The game was saved to your history", "Игра записана в историю")}</span>
    ) : (
      <span className="text-white/60">{tt("კერძო თამაში არ იწერება ისტორიაში", "Private games are not saved to the history", "Частные игры не записываются в историю")}</span>
    );

  const chat = (
    <TableChat
      tableId={t.table.id}
      over={t.table.status === "finished" || t.table.status === "closed"}
      myId={user.id}
      names={Object.fromEntries(t.players.flatMap((p) => (p?.profile ? [[p.user_id, p.profile.nickname]] : [])))}
    />
  );

  if (t.table.game === "bura") {
    return (
      <>
        {chat}
        <BuraTable
          game={t.view as BuraState}
          secondsLeft={t.secondsLeft}
          names={names}
          avatars={avatars}
          onPlay={(ids) => void t.playCards(ids)}
          onAct={(a) => void t.buraAct(a)}
          onNext={() => {}}
          autoNext
          onQuit={leaveToMenu}
          quitConfirm={quitConfirm}
          endNote={note}
        />
        {t.notice && <Notice text={t.notice} />}
      </>
    );
  }

  return (
    <PlayerNamesProvider names={names} avatars={avatars}>
      {chat}
      <Table
        game={t.view as GameState}
        secondsLeft={t.secondsLeft}
        onBid={(bid) => void t.act({ type: "bid", bid })}
        onTrump={(suit) => void t.act({ type: "trump", suit })}
        onPlay={(option) => void t.act({ type: "play", option })}
        onQuit={leaveToMenu}
        quitConfirm={quitConfirm}
        endNote={note}
      />
      {t.notice && <Notice text={t.notice} />}
    </PlayerNamesProvider>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-4 z-50 mx-auto w-fit max-w-[90vw] rounded-full border border-red-400/40 bg-[#2a1010] px-5 py-2.5 text-sm text-red-200 shadow-lg"
    >
      {text}
    </div>
  );
}

function Message({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <PageShell width="max-w-xl">
      <section className="flex flex-col gap-4" style={rise(1)}>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        {text && <p className="text-lg text-white/55">{text}</p>}
        {action}
      </section>
    </PageShell>
  );
}

type LobbyPlayer = ReturnType<typeof useOnlineTable>["players"][number];

function Lobby({
  code,
  rules,
  game,
  players,
  hostId,
  myId,
  starting,
  onLeave,
}: {
  code: string;
  rules: Rules | BuraRules | PokerRules;
  game: "joker" | "bura" | "poker";
  players: LobbyPlayer[];
  hostId: string;
  myId: string;
  starting: boolean;
  onLeave: () => void;
}) {
  useLang();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const seated = players.filter(Boolean).length;

  const copy = async (what: "code" | "link") => {
    const text = what === "code" ? code : `${window.location.origin}/${game}/table/${code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      window.prompt(tt("დააკოპირეთ:", "Copy this:", "Скопируйте:"), text);
    }
  };

  return (
    <PageShell width="max-w-3xl">
      <section className="flex flex-col gap-2" style={rise(1)}>
        <p className="text-sm font-bold uppercase tracking-wider text-white/45">{tt("კერძო მაგიდა", "Private table", "Частный стол")}</p>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">{tt("მაგიდის კოდი", "Table code", "Код стола")}</h1>
        <p className="text-lg text-white/55">{game === "poker" ? describePoker(rules as PokerRules) : game === "bura" ? describeBura(rules as BuraRules) : describeRules(rules as Rules)}</p>
      </section>

      <section className="flex flex-col gap-5" style={rise(2)}>
        <div className="flex gap-2 sm:gap-3" aria-label={tt(`კოდი ${code}`, `Code ${code}`, `Код ${code}`)}>
          {code.split("").map((ch, i) => (
            <span
              key={i}
              className="grid h-16 flex-1 place-items-center rounded-2xl border border-white/15 bg-white/[0.05] text-3xl font-extrabold tabular-nums text-amber-300 sm:h-24 sm:text-5xl"
            >
              {ch}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <button className={BTN_GHOST} onClick={() => copy("code")}>
            {copied === "code" ? "✓ " + tt("დაკოპირდა", "Copied", "Скопировано") : tt("კოდის კოპირება", "Copy code", "Копировать код")}
          </button>
          <button className={BTN_GHOST} onClick={() => copy("link")}>
            {copied === "link" ? "✓ " + tt("დაკოპირდა", "Copied", "Скопировано") : tt("ბმულის კოპირება", "Copy link", "Копировать ссылку")}
          </button>
        </div>
        <p className="text-white/45">{tt("გაუგზავნეთ მეგობრებს კოდი ან ბმული. როცა ყველა დაჯდება, თამაში თავისით დაიწყება.", "Send your friends the code or link. When everyone has sat down, the game starts by itself.", "Отправьте друзьям код или ссылку. Когда все сядут, игра начнётся сама.")}</p>
      </section>

      <section className="flex flex-col gap-4" style={rise(3)}>
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-extrabold">{tt("მოთამაშეები", "Players", "Игроки")}</h2>
          <span className={`text-lg font-bold tabular-nums ${starting ? "text-emerald-300" : "text-white/50"}`}>
            {starting ? tt("თამაში იწყება…", "The game is starting…", "Игра начинается…") : `${seated}/${players.length}`}
          </span>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {players.map((_, seat) => {
            // `players` is ordered from my seat; the lobby lists real seats, so find by position.
            const p = players.find((x) => x?.seat === seat) ?? null;
            return p ? (
              <li
                key={seat}
                className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/[0.05] p-4"
              >
                <Avatar
                  size="md"
                  color={p.profile?.avatar_color}
                  icon={p.profile?.avatar_icon}
                  url={p.profile?.avatar_url}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold">{p.profile?.nickname ?? "…"}</span>
                  <span className="block text-sm text-white/45">
                    {p.user_id === hostId && tt("მასპინძელი", "Host", "Хозяин")}
                    {p.user_id === hostId && p.user_id === myId && " · "}
                    {p.user_id === myId && tt("თქვენ", "You", "Вы")}
                  </span>
                </span>
              </li>
            ) : (
              <li
                key={seat}
                className="flex items-center gap-4 rounded-2xl border border-dashed border-white/15 p-4 text-white/35"
              >
                <span className="grid size-12 animate-pulse place-items-center rounded-full bg-white/[0.06] text-xl">?</span>
                <span className="text-lg">{tt("ელოდება მოთამაშეს…", "Waiting for a player…", "Ожидание игрока…")}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="pb-8" style={rise(4)}>
        <button className={BTN_GHOST} onClick={onLeave}>
          {tt("მაგიდის დატოვება", "Leave the table", "Покинуть стол")}
        </button>
      </div>
    </PageShell>
  );
}
