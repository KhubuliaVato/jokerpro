"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cityName } from "@/lib/cities";
import {
  answerFriendRequest,
  EMPTY_FRIENDS,
  loadFriends,
  removeFriend,
  seenAgo,
  sendFriendRequest,
  setHidePresence,
  touchPresence,
  type Friend,
  type FriendList,
} from "@/lib/friends";
import { useT } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";
import { Avatar } from "./Avatar";
import { Nick } from "./Nick";

const OPEN_KEY = "friends-open";
const GAME_NAMES: Record<string, [string, string, string]> = {
  joker: ["ჯოკერი", "Joker", "Джокер"],
  bura: ["ბურა", "Bura", "Бура"],
  poker: ["პოკერი", "Poker", "Покер"],
};

/** Pages where the game fills the whole screen: the panel stays out of the way (the heartbeat still runs). */
const FULLSCREEN = /^\/(joker|bura|poker|nardi)\/(table|bots)/;

/**
 * The friends on the right edge: a small tab that opens a list of the player's friends and who of them is
 * online (or playing) right now. The page also tells the server every minute that this player is here.
 */
export function FriendsDock() {
  const { user } = useAuth();
  const t = useT();
  const path = usePathname();
  const userId = user?.id ?? null;
  const [open, setOpen] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(OPEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [list, setList] = useState<{ userId: string; data: FriendList } | null>(null);
  const [nick, setNick] = useState("");
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [hiddenNow, setHiddenNow] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      // not remembered
    }
  };

  const refresh = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    const data = await loadFriends(supabase);
    setList({ userId, data });
  }, [userId]);

  // the heartbeat, and the list (every 30 seconds while the page is seen)
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let off = false;
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      void touchPresence(supabase);
    };
    const pull = () => {
      if (document.visibilityState !== "visible") return;
      loadFriends(supabase).then((data) => {
        if (!off) setList({ userId, data });
      });
    };
    beat();
    pull();
    const b = setInterval(beat, 45_000);
    const p = setInterval(pull, 30_000);
    const vis = () => {
      beat();
      pull();
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      off = true;
      clearInterval(b);
      clearInterval(p);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [userId]);

  if (!userId || FULLSCREEN.test(path)) return null;

  const data = list && list.userId === userId ? list.data : EMPTY_FRIENDS;
  const hidden = hiddenNow ?? data.hidden;
  const online = data.friends.filter((f) => f.online).length;
  const requests = data.incoming.length;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabase();
    const name = nick.trim();
    if (!supabase || !name || busy) return;
    setBusy(true);
    const r = await sendFriendRequest(supabase, name);
    setNote(r);
    if (r.ok) setNick("");
    setBusy(false);
    await refresh();
  };
  const answer = async (id: string, accept: boolean) => {
    const supabase = getSupabase();
    if (!supabase) return;
    await answerFriendRequest(supabase, id, accept);
    await refresh();
  };
  const remove = async (f: Friend) => {
    const supabase = getSupabase();
    if (!supabase) return;
    if (!window.confirm(t(`${f.nickname} მეგობრებიდან ამოვიღოთ?`, `Remove ${f.nickname} from friends?`, `Убрать ${f.nickname} из друзей?`))) return;
    await removeFriend(supabase, f.id);
    await refresh();
  };
  const toggleHidden = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const next = !hidden;
    setHiddenNow(next);
    await setHidePresence(supabase, next);
  };

  const status = (f: Friend) =>
    f.playing
      ? { dot: "bg-amber-300", text: `${t("თამაშობს", "Playing", "Играет")}${f.game && GAME_NAMES[f.game] ? ` · ${t(...GAME_NAMES[f.game])}` : ""}`, tone: "text-amber-200" }
      : f.online
        ? { dot: "bg-emerald-400", text: t("ონლაინ", "Online", "В сети"), tone: "text-emerald-300" }
        : { dot: "bg-white/25", text: f.last_seen ? seenAgo(f.last_seen) : t("ოფლაინ", "Offline", "Не в сети"), tone: "text-white/40" };

  return (
    <>
      {/* the tab on the edge */}
      <button
        type="button"
        onClick={() => toggle(!open)}
        aria-expanded={open}
        aria-label={t("მეგობრები", "Friends", "Друзья")}
        className={`fixed right-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-l-2xl border border-r-0 border-white/15 bg-[#1a0a10]/90 px-2.5 py-3 text-white/80 shadow-xl backdrop-blur transition-[translate,background-color] duration-300 hover:bg-[#2a0f18] ${open ? "translate-x-full" : ""}`}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
          <circle cx="17.5" cy="9" r="2.4" />
          <path d="M16.5 14.6c3 .2 4.5 2 4.5 5" />
        </svg>
        <span className="flex items-center gap-1 text-xs font-extrabold tabular-nums">
          <span className={`size-2 rounded-full ${online > 0 ? "bg-emerald-400" : "bg-white/25"}`} />
          {online}
        </span>
        {requests > 0 && <span className="grid size-5 place-items-center rounded-full bg-red-500 text-[0.65rem] font-black text-white">{requests}</span>}
      </button>

      {/* the panel */}
      <aside
        aria-hidden={!open}
        className={`fixed bottom-4 right-3 top-24 z-40 flex w-[min(21rem,94vw)] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#1a0a10]/95 shadow-2xl backdrop-blur transition-[translate,opacity] duration-300 ${open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[110%] opacity-0"}`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            {t("მეგობრები", "Friends", "Друзья")}
            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-bold text-emerald-300">
              {online} {t("ონლაინ", "online", "в сети")}
            </span>
          </h2>
          <button type="button" onClick={() => toggle(false)} aria-label={t("დახურვა", "Close", "Закрыть")} className="grid size-8 place-items-center rounded-full bg-white/10 text-lg leading-none text-white/75 hover:bg-white/20">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <form onSubmit={add} className="flex gap-2">
            <input
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              maxLength={16}
              placeholder={t("მეგობრის სახელი", "Friend's nickname", "Ник друга")}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-amber-300"
            />
            <button type="submit" disabled={busy || nick.trim().length < 2} className="rounded-xl bg-amber-300 px-3.5 py-2 text-sm font-extrabold text-black transition-opacity disabled:opacity-40">
              +
            </button>
          </form>
          {note && <p className={`mt-2 px-1 text-xs font-bold ${note.ok ? "text-emerald-300" : "text-red-300"}`}>{note.text}</p>}

          {requests > 0 && (
            <section className="mt-4">
              <h3 className="mb-1.5 px-1 text-[0.7rem] font-extrabold uppercase tracking-wider text-white/45">{t("თხოვნები", "Requests", "Заявки")}</h3>
              <ul className="flex flex-col gap-1.5">
                {data.incoming.map((r) => (
                  <li key={r.id} className="flex items-center gap-2.5 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] px-2.5 py-2">
                    <Avatar size="sm" color={r.avatar_color} icon={r.avatar_icon} url={r.avatar_url} frame={r.equipped_frame ?? undefined} />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">
                      <Nick name={r.nickname} style={r.equipped_name} />
                    </span>
                    <button type="button" onClick={() => void answer(r.id, true)} className="grid size-8 place-items-center rounded-full bg-emerald-400 font-black text-black" aria-label={t("მიღება", "Accept", "Принять")}>
                      ✓
                    </button>
                    <button type="button" onClick={() => void answer(r.id, false)} className="grid size-8 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-red-500/60" aria-label={t("უარყოფა", "Decline", "Отклонить")}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-4">
            <h3 className="mb-1.5 px-1 text-[0.7rem] font-extrabold uppercase tracking-wider text-white/45">
              {t("ჩემი მეგობრები", "My friends", "Мои друзья")} · {data.friends.length}
            </h3>
            {data.friends.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/15 px-3 py-6 text-center text-sm text-white/45">
                {t("ჯერ არავინ გყავთ. დაამატეთ მეგობრის სახელი ზემოთ.", "No friends yet. Add a nickname above.", "Пока никого. Добавьте ник выше.")}
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {data.friends.map((f) => {
                  const s = status(f);
                  return (
                    <li key={f.id} className="group flex items-center gap-2.5 rounded-2xl px-2 py-1.5 transition-colors hover:bg-white/[0.06]">
                      <Link href={`/players/${f.id}`} className="flex min-w-0 flex-1 items-center gap-2.5" onClick={() => toggle(false)}>
                        <span className="relative flex-none">
                          <Avatar size="sm" color={f.avatar_color} icon={f.avatar_icon} url={f.avatar_url} frame={f.equipped_frame ?? undefined} />
                          <span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-[#1a0a10] ${s.dot}`} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">
                            <Nick name={f.nickname} style={f.equipped_name} />
                          </span>
                          <span className={`block truncate text-xs ${s.tone}`}>
                            {s.text}
                            {f.city ? <span className="text-white/35"> · {cityName(f.city)}</span> : null}
                          </span>
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => void remove(f)}
                        aria-label={t("მეგობრებიდან ამოღება", "Remove friend", "Убрать из друзей")}
                        className="grid size-7 flex-none place-items-center rounded-full text-sm text-white/0 transition-colors group-hover:bg-white/10 group-hover:text-white/60 hover:!bg-red-500/50 hover:!text-white"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {data.outgoing.length > 0 && (
            <p className="mt-3 px-1 text-xs text-white/40">
              {t("ელოდებით პასუხს", "Waiting for an answer", "Ждёте ответа")}: {data.outgoing.map((o) => o.nickname).join(", ")}
            </p>
          )}
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-white/10 px-4 py-2.5 text-xs text-white/55">
          <span>{t("ონლაინ სტატუსის დამალვა", "Hide my online status", "Скрыть мой статус")}</span>
          <input type="checkbox" checked={hidden} onChange={() => void toggleHidden()} className="size-4 accent-amber-300" />
        </label>
      </aside>
    </>
  );
}
