"use client";

import { tt, useT } from "@/lib/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTableChat, type ChatMessage } from "@/lib/online/useTableChat";
import Link from "next/link";
import { CHAT_EMOJI, cosmetic, parseFx, REACTIONS, THROWABLES } from "@/lib/cosmetics";
import { FxLayer, type ActiveFx } from "./TableFx";
import { loadInventory } from "@/lib/shop";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth/AuthProvider";

/** The chat of an online table: messages live in the database and are deleted with the game. */
export function TableChat({
  tableId,
  over,
  myId,
  names,
  seats,
}: {
  tableId: string;
  over: boolean;
  myId: string;
  names: Record<string, string>;
  /** Who sits where: `abs` is the real seat number, `disp` the place on this player's screen (0 is them). */
  seats: Seat[];
}) {
  const { messages, send } = useTableChat(tableId, over);
  return <ChatView messages={messages} send={send} over={over} myId={myId} names={names} seats={seats} />;
}

/** Fired by a player at the table when tapped; the chat answers with the things you can throw at them. */
export const SEAT_TAP = "table:seat-tap";

export function tapSeat(e: React.MouseEvent<HTMLElement>, seat: number) {
  const r = e.currentTarget.getBoundingClientRect();
  window.dispatchEvent(new CustomEvent(SEAT_TAP, { detail: { seat, x: r.left + r.width / 2, y: r.bottom } }));
}

const THROW_GAP_MS = 60_000;

export interface Seat {
  userId: string;
  abs: number;
  disp: number;
}

const BOT_LINES: [string, string, string][] = [
  ["წარმატებებს გისურვებთ!", "Good luck!", "Удачи!"],
  ["კარგი სვლა იყო 👏", "Nice move 👏", "Хороший ход 👏"],
  ["ახლა ვნახოთ…", "Let us see…", "Посмотрим…"],
  ["ჰმ, საინტერესოა", "Hmm, interesting", "Хм, интересно"],
  ["ამას არ ველოდი 😄", "Did not expect that 😄", "Не ожидал 😄"],
  ["კოზირი კარგი გაქვს?", "Got a good trump?", "Хороший козырь?"],
];

/** Practice games have no one to talk to: the bots answer with a few stock phrases, so the chat can be tried out. */
export function BotChat({ myId, bots }: { myId: string; bots: string[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const next = useRef(1);
  const names = Object.fromEntries(bots.map((b) => [`bot:${b}`, b]));

  const say = useCallback(
    (userId: string, body: string) =>
      setMessages((prev) => [...prev, { id: next.current++, user_id: userId, body, created_at: new Date().toISOString() }]),
    [],
  );
  // The caller builds a new `bots` array on every render; keep the latest in a ref so the timers are not reset.
  const botsRef = useRef(bots);
  useEffect(() => {
    botsRef.current = bots;
  });
  const botSays = useCallback(() => {
    const list = botsRef.current;
    if (list.length === 0) return;
    const b = list[Math.floor(Math.random() * list.length)];
    say(`bot:${b}`, tt(...BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)]));
  }, [say]);

  // Now and then a bot speaks up on its own.
  useEffect(() => {
    const id = setInterval(botSays, 12000);
    return () => clearInterval(id);
  }, [botSays]);

  const send = useCallback(
    async (body: string) => {
      say(myId, body);
      if (!body.startsWith("::")) setTimeout(botSays, 1000 + Math.random() * 1200);
    },
    [say, botSays, myId],
  );

  // seat 0 is the player, the bots sit after them, so reactions and throws work in practice games too
  const seats: Seat[] = [{ userId: myId, abs: 0, disp: 0 }, ...bots.map((b, i) => ({ userId: `bot:${b}`, abs: i + 1, disp: i + 1 }))];
  return <ChatView messages={messages} send={send} over={false} myId={myId} names={names} seats={seats} />;
}

/**
 * A very small chat: a round button in the corner that opens a panel. While closed, new messages from others turn
 * the button red and count them. When the game is over the chat is deleted on the server and the widget says
 * goodbye with a trash can. Next to the text box: free emoji, and (for what the player has bought) animated
 * reactions and things to throw at another player.
 */
function ChatView({
  messages,
  send,
  over,
  myId,
  names,
  seats,
}: {
  messages: ChatMessage[];
  send: (body: string) => Promise<void>;
  over: boolean;
  myId: string;
  names: Record<string, string>;
  seats?: Seat[];
}) {
  const t = useT();
  // practice games call the player "me": the inventory belongs to whoever is signed in
  const { user } = useAuth();
  const ownerId = user?.id ?? null;
  const [open, setOpen] = useState(false);
  const [seenId, setSeenId] = useState(0);
  const [text, setText] = useState("");
  const [binShown, setBinShown] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const hadChat = useRef(false);
  const [picker, setPicker] = useState<null | "emoji" | "react">(null);
  const [owned, setOwned] = useState<string[]>([]);
  // one throw a minute per player (the server keeps the same rule)
  const [lastThrow, setLastThrow] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [tap, setTap] = useState<{ seat: number; x: number; y: number } | null>(null);
  const [fx, setFx] = useState<ActiveFx[]>([]);
  const seen = useRef<number | null>(null);

  // what this player has bought (reactions and throwables are only for tables with other people)
  const withPeople = !!seats;
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !withPeople || !ownerId) return;
    let cancelled = false;
    loadInventory(supabase, ownerId).then((ids) => {
      if (!cancelled) setOwned(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerId, withPeople]);
  const myReactions = REACTIONS.filter((r) => owned.includes(r.id));
  const myThrowables = THROWABLES.filter((x) => owned.includes(x.id));

  // a reaction or a thrown thing: everybody at the table sees it, even while the chat is closed
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1].id;
    if (seen.current === null) {
      seen.current = last;
      return;
    }
    const fresh = messages.filter((m) => m.id > (seen.current ?? 0));
    seen.current = last;
    const added: ActiveFx[] = [];
    for (const m of fresh) {
      const parsed = parseFx(m.body);
      if (!parsed) continue;
      const who = m.user_id === myId ? t("თქვენ", "You", "Вы") : (names[m.user_id] ?? "…");
      if (parsed.kind === "r") added.push({ key: m.id, kind: "r", id: parsed.id, who });
      else {
        const from = seats?.find((x) => x.userId === m.user_id)?.disp ?? null;
        const to = seats?.find((x) => x.abs === parsed.seat)?.disp ?? null;
        added.push({ key: m.id, kind: "t", id: parsed.id, who, from, to });
      }
    }
    if (added.length > 0) queueMicrotask(() => setFx((prev) => [...prev, ...added].slice(-6)));
  }, [messages, myId, names, seats, t]);
  // tapping a player at the table opens the list of things to throw at them
  useEffect(() => {
    if (!withPeople) return;
    const on = (e: Event) => {
      setNow(Date.now());
      setTap((e as CustomEvent<{ seat: number; x: number; y: number }>).detail);
    };
    window.addEventListener(SEAT_TAP, on);
    return () => window.removeEventListener(SEAT_TAP, on);
  }, [withPeople]);
  const wait = Math.max(0, Math.ceil((lastThrow + THROW_GAP_MS - now) / 1000));
  useEffect(() => {
    if (!tap) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [tap]);
  const target = tap ? seats?.find((x) => x.disp === tap.seat) : undefined;
  const done = useCallback((key: number) => setFx((prev) => prev.filter((x) => x.key !== key)), []);

  const lastId = messages.length > 0 ? messages[messages.length - 1].id : 0;
  const unread = open ? 0 : messages.filter((m) => m.id > seenId && m.user_id !== myId && !parseFx(m.body)).length;

  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages.length, open]);

  // The game ended while there was a chat: show the trash can for a moment, then the widget is gone.
  useEffect(() => {
    if (!over) {
      hadChat.current = true;
      return;
    }
    if (!hadChat.current) return;
    hadChat.current = false;
    const show = setTimeout(() => {
      setOpen(false);
      setBinShown(true);
    }, 0);
    const hide = setTimeout(() => setBinShown(false), 3200);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [over]);

  const toggle = () => {
    setSeenId(lastId);
    setOpen((o) => !o);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    void send(body);
  };

  if (over) {
    return binShown ? (
      <div
        role="status"
        className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-full border border-white/15 bg-[#0b2a1b]/95 px-4 py-2.5 text-sm text-white/75 shadow-lg"
      >
        <span aria-hidden className="text-lg">🗑</span>{t("ჩათი წაიშალა", "Chat deleted", "Чат удалён")}
      </div>
    ) : null;
  }

  const tab = (id: "emoji" | "react", label: string) => (
    <button
      type="button"
      onClick={() => setPicker(id)}
      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${picker === id ? "bg-amber-300 text-black" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
    >
      {label}
    </button>
  );
  const shopLink = (
    <Link href="/shop" className="font-bold text-amber-300 underline underline-offset-2">
      {t("მაღაზიაში", "In the shop", "В магазине")} →
    </Link>
  );

  return (
    <div className="fixed bottom-3 right-3 z-50 flex flex-col items-end gap-2">
      <FxLayer items={fx} onDone={done} />
      {tap && target && (
        <div className="fixed inset-0 z-[55]" onPointerDown={() => setTap(null)}>
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute max-w-[15rem] -translate-x-1/2 rounded-xl border border-white/15 bg-[#0b1020]/92 p-1.5 shadow-lg backdrop-blur-sm"
            style={{ left: Math.min(Math.max(tap.x, 140), window.innerWidth - 140), top: Math.min(tap.y + 8, window.innerHeight - 110) }}
          >
            {myThrowables.length === 0 ? (
              <p className="max-w-[14rem] px-1 text-xs text-white/60">
                {t("სასროლი ნივთები ჯერ არ გაქვთ.", "You have nothing to throw yet.", "Бросать пока нечего.")} {shopLink}
              </p>
            ) : wait > 0 ? (
              <p className="flex items-center gap-2 px-2 py-1 text-sm font-bold text-white/70">
                {t(`შემდეგი სროლა ${wait} წმ-ში`, `Next throw in ${wait}s`, `Следующий бросок через ${wait} с`)}
              </p>
            ) : (
              <div className="flex flex-wrap justify-center gap-1">
                {myThrowables.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    title={cosmetic(x.id)?.name}
                    aria-label={cosmetic(x.id)?.name}
                    onClick={() => {
                      void send(`::t:${x.id}.${target.abs}`);
                      setLastThrow(Date.now());
                      setTap(null);
                    }}
                    className="grid size-11 place-items-center rounded-lg bg-white/10 text-2xl sm:size-9 sm:text-xl leading-none transition-transform hover:scale-110 hover:bg-white/20 active:scale-95"
                  >
                    {x.main}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {open && (
        <div className="flex h-[24rem] max-h-[calc(100dvh-5rem)] w-72 sm:h-72 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0b2a1b]/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-sm font-bold">
            {t("ჩათი", "Chat", "Чат")}
            <button onClick={toggle} aria-label={t("ჩათის დახურვა", "Close chat", "Закрыть чат")} className="px-1 text-lg leading-none text-white/60 hover:text-white">
              ×
            </button>
          </div>
          <div ref={list} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-2 text-sm">
            {messages.length === 0 && <p className="m-auto text-white/40">{t("შეტყობინება ჯერ არ არის", "No messages yet", "Сообщений пока нет")}</p>}
            {messages.map((m) => (
              <p key={m.id} className="break-words">
                <span className={`font-bold ${m.user_id === myId ? "text-amber-300" : "text-emerald-300"}`}>
                  {m.user_id === myId ? t("თქვენ", "You", "Вы") : (names[m.user_id] ?? "…")}:
                </span>{" "}
                <MessageBody body={m.body} />
              </p>
            ))}
          </div>
          {picker && (
            <div className="max-h-36 overflow-y-auto border-t border-white/10 px-2 py-1.5">
              <div className="mb-1.5 flex items-center gap-1.5">
                {tab("emoji", "😀")}
                {withPeople && tab("react", t("რეაქცია", "Reactions", "Реакции"))}
              </div>
              {picker === "emoji" && (
                <div className="flex flex-wrap gap-1">
                  {CHAT_EMOJI.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        void send(e);
                        setPicker(null);
                      }}
                      className="rounded-lg bg-white/10 px-1.5 py-1 text-xl leading-none hover:bg-white/20"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
              {picker === "react" &&
                (myReactions.length === 0 ? (
                  <p className="text-xs text-white/55">
                    {t("ანიმირებული რეაქციები ჯერ არ გაქვთ.", "You have no animated reactions yet.", "Анимированных реакций пока нет.")} {shopLink}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {myReactions.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        title={cosmetic(r.id)?.name}
                        onClick={() => {
                          void send(`::r:${r.id}`);
                          setPicker(null);
                        }}
                        className="rounded-lg bg-white/10 px-2 py-1 text-2xl leading-none hover:bg-white/20"
                      >
                        {r.main}
                      </button>
                    ))}
                  </div>
                ))}
            </div>
          )}
          <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-2">
            <button
              type="button"
              onClick={() => setPicker((v) => (v ? null : "emoji"))}
              aria-label={t("ემოციები", "Emotes", "Эмоции")}
              aria-expanded={!!picker}
              className={`rounded-full px-2 text-lg leading-none transition-colors ${picker ? "bg-amber-300/25" : "bg-white/10 hover:bg-white/20"}`}
            >
              😀
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={200}
              placeholder={t("დაწერეთ…", "Write…", "Напишите…")}
              className="min-w-0 flex-1 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white outline-none placeholder:text-white/35 focus:bg-white/15"
            />
            <button type="submit" className="rounded-full bg-amber-300 px-3 text-sm font-bold text-[#2a1d00]">
              ➤
            </button>
          </form>
        </div>
      )}
      {!open && (
        <button
          onClick={toggle}
          aria-label={unread > 0 ? t(`ჩათი, ახალი შეტყობინებები: ${unread}`, `Chat, new messages: ${unread}`, `Чат, новых сообщений: ${unread}`) : t("ჩათი", "Chat", "Чат")}
          className={`relative grid size-11 place-items-center rounded-full border text-xl shadow-lg transition-colors ${
            unread > 0 ? "animate-pulse border-red-300/60 bg-red-600" : "border-white/20 bg-[#0b2a1b]/90 hover:bg-[#12402a]"
          }`}
        >
          <span aria-hidden>💬</span>
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-white px-1 text-xs font-extrabold leading-5 text-red-600">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

/** The text of a chat message; a lone emoji is shown big, a reaction or a throw as a short note. */
function MessageBody({ body }: { body: string }) {
  const fx = parseFx(body);
  if (fx) {
    const def = fx.kind === "r" ? REACTIONS.find((r) => r.id === fx.id) : THROWABLES.find((x) => x.id === fx.id);
    return (
      <span className="text-amber-100/90">
        {def?.main} {cosmetic(fx.id)?.name}
      </span>
    );
  }
  const bare = body.length <= 4 && !/[\p{L}\p{N}]/u.test(body);
  return <span className={bare ? "align-middle text-2xl leading-none" : "text-white/90"}>{body}</span>;
}
