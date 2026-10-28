"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useOnlineTable } from "@/lib/online/useOnlineTable";
import type { Rules } from "@/lib/joker/rules";
import type { BuraState } from "@/lib/bura/engine";
import type { BuraRules } from "@/lib/bura/online";
import type { GameState } from "@/lib/joker/engine";
import { Avatar } from "./Avatar";
import { PlayerNamesProvider } from "./names";
import { PageShell } from "./PageShell";
import { QueueLobby } from "./QueueLobby";
import { RatingResult } from "./RatingResult";
import { BuraTable } from "./BuraTable";
import { Table } from "./Table";
import { TableChat } from "./TableChat";
import { BTN_GHOST, BTN_PRIMARY, FORMAT_LABEL, rise } from "./ui";

/** "სრული თამაში · ხიშტი −200" */
export const describeRules = (r: Rules) =>
  `${FORMAT_LABEL[r.format]} · ხიშტი −${r.format === "nine" ? r.khishti * 2 : `${r.khishti} / −${r.khishti * 2}`}${r.pulkaPremium ? " · ეტაპის პრემია" : ""}`;

/** "2 მოთამაშე" / "4 მოთამაშე · 2×2" */
export const describeBura = (r: BuraRules) => (r.players === 4 ? "4 მოთამაშე · 2×2" : "2 მოთამაშე");

/** The screen behind a table code: the waiting room first, the game itself once four players sit. */
export function OnlineTable({ code }: { code: string }) {
  const router = useRouter();
  const { configured, loading, user } = useAuth();
  const t = useOnlineTable(code);

  const game = t.table?.game ?? "joker";
  const back = () => router.push(`/${game}`);
  const leaveToMenu = async () => {
    await t.leave();
    back();
  };

  if (!configured) return <Message title="ონლაინ თამაში ჯერ არ არის ჩართული" />;
  if (loading) return <Message title="…" />;
  if (!user) {
    return (
      <Message
        title="ონლაინ მაგიდაზე შესასვლელად შედით ანგარიშში"
        action={
          <Link href={`/login?next=${encodeURIComponent(`/joker/table/${code}`)}`} className={`${BTN_PRIMARY} w-fit`}>
            შესვლა
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
            ← უკან
          </Link>
        }
      />
    );
  }
  if (!t.table) return <Message title="მაგიდასთან გამაერთიანებთ…" />;

  // My seat was taken over by a bot (I left or timed out twice): I can only watch the end, so show the way out.
  if (t.mySeat?.bot && t.table.status !== "waiting") {
    return (
      <Message
        title="ადგილი ბოტმა დაიკავა"
        text="ზედიზედ ორჯერ გამოტოვეთ სვლა ან მაგიდა დატოვეთ."
        action={
          <Link href={`/${game}`} className={`${BTN_GHOST} w-fit`}>
            ← უკან
          </Link>
        }
      />
    );
  }

  // The ready check ran out before I accepted: the seat is gone.
  if (t.kicked) {
    return (
      <Message
        title="დრო ამოიწურა"
        text="მატჩი დროზე არ დაადასტურეთ."
        action={
          <Link href={`/${game}/${t.table.kind}`} className={`${BTN_PRIMARY} w-fit`}>
            ხელახლა ძებნა
          </Link>
        }
      />
    );
  }

  if (t.table.status === "waiting" || !t.view) {
    if (t.table.status === "closed") return <Message title="მაგიდა დაიხურა" />;
    // Random-player tables wait in a lobby with four lamps; private ones show the code to share.
    if (t.table.kind !== "private") {
      return (
        <QueueLobby
          kind={t.table.kind}
          rules={t.table.rules}
          game={game}
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

  const names = t.players.map((p, k) => (p?.profile?.nickname ?? (k === 0 ? "თქვენ" : "…")) + (p?.bot && k !== 0 ? " · ბოტი" : ""));
  const avatars = t.players.map((p) =>
    p?.profile
      ? { color: p.profile.avatar_color, icon: p.profile.avatar_icon, url: p.profile.avatar_url }
      : null,
  );

  const quitConfirm =
    t.table.kind === "ranked"
      ? "დარწმუნებული ხართ? თამაშიდან გასვლა წოდებისთვის ბრძოლაში −10 ქულას ნიშნავს და თქვენს ადგილს ბოტი დაიკავებს."
      : "დარწმუნებული ხართ? გასვლისას თქვენს ადგილს ბოტი დაიკავებს.";
  const note =
    t.table.kind === "ranked" ? (
      <RatingResult tableId={t.table.id} userId={user.id} />
    ) : t.table.kind === "friendly" ? (
      <span className="text-emerald-300">✓ თამაში ჩაიწერა ისტორიაში</span>
    ) : (
      <span className="text-white/60">კერძო თამაში არ იწერება ისტორიაში</span>
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
  rules: Rules | BuraRules;
  game: "joker" | "bura";
  players: LobbyPlayer[];
  hostId: string;
  myId: string;
  starting: boolean;
  onLeave: () => void;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const seated = players.filter(Boolean).length;

  const copy = async (what: "code" | "link") => {
    const text = what === "code" ? code : `${window.location.origin}/${game}/table/${code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      window.prompt("დააკოპირეთ:", text);
    }
  };

  return (
    <PageShell width="max-w-3xl">
      <section className="flex flex-col gap-2" style={rise(1)}>
        <p className="text-sm font-bold uppercase tracking-wider text-white/45">კერძო მაგიდა</p>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">მაგიდის კოდი</h1>
        <p className="text-lg text-white/55">{game === "bura" ? describeBura(rules as BuraRules) : describeRules(rules as Rules)}</p>
      </section>

      <section className="flex flex-col gap-5" style={rise(2)}>
        <div className="flex gap-2 sm:gap-3" aria-label={`კოდი ${code}`}>
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
            {copied === "code" ? "✓ დაკოპირდა" : "კოდის კოპირება"}
          </button>
          <button className={BTN_GHOST} onClick={() => copy("link")}>
            {copied === "link" ? "✓ დაკოპირდა" : "ბმულის კოპირება"}
          </button>
        </div>
        <p className="text-white/45">გაუგზავნეთ მეგობრებს კოდი ან ბმული. როცა ყველა დაჯდება, თამაში თავისით დაიწყება.</p>
      </section>

      <section className="flex flex-col gap-4" style={rise(3)}>
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-extrabold">მოთამაშეები</h2>
          <span className={`text-lg font-bold tabular-nums ${starting ? "text-emerald-300" : "text-white/50"}`}>
            {starting ? "თამაში იწყება…" : `${seated}/${players.length}`}
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
                    {p.user_id === hostId && "მასპინძელი"}
                    {p.user_id === hostId && p.user_id === myId && " · "}
                    {p.user_id === myId && "თქვენ"}
                  </span>
                </span>
              </li>
            ) : (
              <li
                key={seat}
                className="flex items-center gap-4 rounded-2xl border border-dashed border-white/15 p-4 text-white/35"
              >
                <span className="grid size-12 animate-pulse place-items-center rounded-full bg-white/[0.06] text-xl">?</span>
                <span className="text-lg">ელოდება მოთამაშეს…</span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="pb-8" style={rise(4)}>
        <button className={BTN_GHOST} onClick={onLeave}>
          მაგიდის დატოვება
        </button>
      </div>
    </PageShell>
  );
}
