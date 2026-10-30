"use client";

import { tt, useT } from "@/lib/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTableChat, type ChatMessage } from "@/lib/online/useTableChat";

/** The chat of an online table: messages live in the database and are deleted with the game. */
export function TableChat({
  tableId,
  over,
  myId,
  names,
}: {
  tableId: string;
  over: boolean;
  myId: string;
  names: Record<string, string>;
}) {
  const { messages, send } = useTableChat(tableId, over);
  return <ChatView messages={messages} send={send} over={over} myId={myId} names={names} />;
}

const BOT_LINES: [string, string, string][] = [
  ["წარმატებებს გისურვებთ!", "Good luck!", "Удачи!"],
  ["კარგი სვლა იყო 👏", "Nice move 👏", "Хороший ход 👏"],
  ["ეხლა ვნახოთ…", "Let us see…", "Посмотрим…"],
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
      setTimeout(botSays, 1000 + Math.random() * 1200);
    },
    [say, botSays, myId],
  );

  return <ChatView messages={messages} send={send} over={false} myId={myId} names={names} />;
}

/**
 * A very small chat: a round button in the corner that opens a panel. While closed, new messages from others turn
 * the button red and count them. When the game is over the chat is deleted on the server and the widget says
 * goodbye with a trash can.
 */
function ChatView({
  messages,
  send,
  over,
  myId,
  names,
}: {
  messages: ChatMessage[];
  send: (body: string) => Promise<void>;
  over: boolean;
  myId: string;
  names: Record<string, string>;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [seenId, setSeenId] = useState(0);
  const [text, setText] = useState("");
  const [binShown, setBinShown] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const hadChat = useRef(false);

  const lastId = messages.length > 0 ? messages[messages.length - 1].id : 0;
  const unread = open ? 0 : messages.filter((m) => m.id > seenId && m.user_id !== myId).length;

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

  return (
    <div className="fixed bottom-3 right-3 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="flex h-72 max-h-[calc(100dvh-5rem)] w-72 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0b2a1b]/95 shadow-2xl backdrop-blur">
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
                <span className="text-white/90">{m.body}</span>
              </p>
            ))}
          </div>
          <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-2">
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
