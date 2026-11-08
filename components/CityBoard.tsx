"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { CITIES, cityName, loadCityBoard, loadCityPlayers, loadMyCity, saveCity, type CityPlayer, type CityRow } from "@/lib/cities";
import { useT } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";
import { Avatar } from "./Avatar";
import { Nick } from "./Nick";
import { rise } from "./ui";

const MEDAL = ["#fcd34d", "#cbd5e1", "#fb923c"];

/** Whether a city change that opens at `iso` is still in the future. */
const lockedUntil = (iso: string | null) => !!iso && Date.parse(iso) > Date.now();

/** A dark drop-down with a search box and the cities as buttons (the browser's own list is white and plain). */
function CitySelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  // closes on a tap outside and on Escape
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent | TouchEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("touchstart", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("touchstart", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const shown = q ? CITIES.filter((c) => c.names.some((n) => n.toLowerCase().includes(q))) : CITIES;
  const chosen = CITIES.find((c) => c.id === value);

  const toggle = () => {
    setQuery("");
    setOpen((o) => !o);
  };

  return (
    <div ref={box} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={`flex w-full items-center justify-between gap-3 rounded-2xl border bg-white/[0.05] px-4 py-3 text-left text-base outline-none transition-colors hover:bg-white/[0.08] focus-visible:border-amber-300 ${open ? "border-amber-300" : "border-white/10"}`}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="text-lg">🏙</span>
          <span className={`truncate ${chosen ? "font-bold text-white" : "text-white/45"}`}>
            {chosen ? t(chosen.names[0], chosen.names[1], chosen.names[2]) : t("აირჩიეთ ქალაქი…", "Choose a city…", "Выберите город…")}
          </span>
        </span>
        <svg viewBox="0 0 24 24" className={`size-5 flex-none text-white/55 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-white/15 bg-[#1a0a10] shadow-[0_24px_50px_-16px_rgb(0_0_0/0.85)]" style={{ animation: "city-pop 0.16s ease-out both" }}>
          <style>{"@keyframes city-pop{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}"}</style>
          <div className="border-b border-white/10 p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("ძებნა…", "Search…", "Поиск…")}
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-amber-300"
            />
          </div>
          <ul id={listId} role="listbox" className="grid max-h-72 grid-cols-2 gap-1 overflow-y-auto p-2 sm:grid-cols-3">
            {shown.map((c) => {
              const on = c.id === value;
              return (
                <li key={c.id} role="option" aria-selected={on}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold transition-colors ${on ? "bg-amber-300 text-black" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                  >
                    <span className="truncate">{t(c.names[0], c.names[1], c.names[2])}</span>
                    {on && <span aria-hidden>✓</span>}
                  </button>
                </li>
              );
            })}
            {shown.length === 0 && <li className="col-span-full px-3 py-5 text-center text-sm text-white/45">{t("ვერაფერი მოიძებნა", "Nothing found", "Ничего не найдено")}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Chooses the city the player plays for (it can be changed once a week). */
export function CityPicker({ onSaved }: { onSaved?: (city: string) => void }) {
  const { user } = useAuth();
  const t = useT();
  const userId = user?.id ?? null;
  const [mine, setMine] = useState<{ userId: string; city: string | null; canChangeAt: string | null; locked: boolean } | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let off = false;
    loadMyCity(supabase).then((c) => {
      if (!off) setMine({ userId, ...c, locked: lockedUntil(c.canChangeAt) });
    });
    return () => {
      off = true;
    };
  }, [userId]);

  if (!userId) return null;
  const current = mine && mine.userId === userId ? mine : null;
  const value = choice ?? current?.city ?? "";
  const locked = current?.locked ?? false;

  const save = async () => {
    const supabase = getSupabase();
    if (!supabase || !value || busy) return;
    setBusy(true);
    const error = await saveCity(supabase, value);
    if (error) {
      setNote({ text: error, ok: false });
    } else {
      setNote({ text: t("შენახულია", "Saved", "Сохранено"), ok: true });
      const fresh = await loadMyCity(supabase);
      setMine({ userId, ...fresh, locked: lockedUntil(fresh.canChangeAt) });
      setChoice(null);
      onSaved?.(value);
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <CitySelect value={value} onChange={setChoice} />
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !value || value === current?.city}
          className="rounded-full bg-amber-300 px-6 py-3 text-base font-extrabold text-black transition-opacity disabled:opacity-40"
        >
          {t("შენახვა", "Save", "Сохранить")}
        </button>
      </div>
      {locked && current?.canChangeAt && (
        <p className="text-sm text-white/45">
          {t("ქალაქის შეცვლა შესაძლებელია", "You can change the city on", "Сменить город можно")} {new Date(current.canChangeAt).toLocaleDateString("ka-GE")}
        </p>
      )}
      {note && <p className={`text-sm font-bold ${note.ok ? "text-emerald-300" : "text-red-300"}`}>{note.text}</p>}
    </div>
  );
}

/** The cities against each other: the points of a city are the scores of its ten best players. */
export function CityBoard() {
  const { user } = useAuth();
  const t = useT();
  const userId = user?.id ?? null;
  const [board, setBoard] = useState<{ rows: CityRow[]; error: string | null } | null>(null);
  const [mine, setMine] = useState<{ userId: string; city: string | null } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [players, setPlayers] = useState<Record<string, CityPlayer[]>>({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let off = false;
    loadCityBoard(supabase).then((b) => {
      if (!off) setBoard(b);
    });
    return () => {
      off = true;
    };
  }, [tick]);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let off = false;
    loadMyCity(supabase).then((c) => {
      if (!off) setMine({ userId, city: c.city });
    });
    return () => {
      off = true;
    };
  }, [userId, tick]);

  const myCity = mine && mine.userId === userId ? mine.city : null;

  const toggle = (city: string) => {
    const next = open === city ? null : city;
    setOpen(next);
    const supabase = getSupabase();
    if (next && supabase && !players[next]) {
      loadCityPlayers(supabase, next).then((list) => setPlayers((p) => ({ ...p, [next]: list })));
    }
  };

  if (!board) return <div className="h-64 animate-pulse rounded-3xl bg-white/[0.06]" />;
  if (board.error) return <p className="text-red-300">{t("ვერ ჩაიტვირთა", "Could not load", "Не удалось загрузить")}: {board.error}</p>;

  const maxPoints = Math.max(1, ...board.rows.map((r) => r.points));

  return (
    <div className="flex flex-col gap-5" style={rise(2)}>
      <p className="max-w-2xl text-white/55">
        {t(
          "ქალაქი იღებს თავისი 10 საუკეთესო მოთამაშის ქულებს (წოდებისთვის მოგებული ქულა 50-ის ზემოთ, ჯოკერსა და ბურაში ერთად). ასე დიდი ქალაქი მხოლოდ რაოდენობით ვერ გაიმარჯვებს.",
          "A city scores the points of its 10 best players (rating earned above 50, Joker and Bura together). A big city cannot win by size alone.",
          "Город получает очки своих 10 лучших игроков (рейтинг выше 50, Джокер и Бура вместе). Большой город не выиграет одним размером.",
        )}
      </p>

      {userId && !myCity && (
        <div className="flex flex-col gap-3 rounded-3xl border border-amber-300/40 bg-amber-300/[0.07] p-5">
          <b className="text-lg">{t("რომელი ქალაქისთვის თამაშობთ?", "Which city do you play for?", "За какой город вы играете?")}</b>
          <CityPicker onSaved={() => setTick((n) => n + 1)} />
        </div>
      )}
      {!userId && (
        <p className="rounded-2xl border border-white/10 px-4 py-3 text-white/60">
          <Link href="/login" className="font-bold text-amber-300 underline underline-offset-4">
            {t("შედით", "Sign in", "Войдите")}
          </Link>{" "}
          {t("და აირჩიეთ თქვენი ქალაქი.", "to choose your city.", "и выберите свой город.")}
        </p>
      )}

      {board.rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/20 px-6 py-14 text-center text-white/55">
          {t("ჯერ არც ერთ ქალაქს არ ჰყავს მოთამაშე. იყავით პირველი!", "No city has a player yet. Be the first!", "Пока ни у одного города нет игроков. Будьте первым!")}
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {board.rows.map((r, i) => {
            const medal = MEDAL[i] ?? null;
            const isMine = r.city === myCity;
            const expanded = open === r.city;
            return (
              <li key={r.city}>
                <button
                  type="button"
                  onClick={() => toggle(r.city)}
                  aria-expanded={expanded}
                  className={`flex w-full flex-col gap-2.5 rounded-2xl border px-4 py-3.5 text-left transition-[border-color,background-color] duration-200 hover:border-white/30 ${isMine ? "border-amber-300/55 bg-amber-300/[0.09]" : "border-white/10 bg-white/[0.03]"}`}
                  style={medal && !isMine ? { borderColor: `${medal}55` } : undefined}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <b className="grid size-10 flex-none place-items-center rounded-full text-lg font-black tabular-nums" style={medal ? { background: medal, color: "#000" } : { background: "rgb(255 255 255 / 0.08)", color: "rgb(255 255 255 / 0.55)" }}>
                      {i + 1}
                    </b>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 truncate text-xl font-extrabold">
                        {cityName(r.city)}
                        {isMine && <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-xs font-bold text-amber-200">{t("თქვენი ქალაქი", "Your city", "Ваш город")}</span>}
                      </span>
                      <span className="block truncate text-sm text-white/45">
                        {r.players} {t("მოთამაშე", "players", "игроков")}
                        {r.leader ? <> · {t("ლიდერი", "Leader", "Лидер")}: <b className="text-white/70">{r.leader}</b></> : null}
                      </span>
                    </span>
                    <span className="flex-none text-right">
                      <b className="block text-2xl font-black tabular-nums sm:text-3xl" style={medal ? { color: medal } : undefined}>
                        {r.points}
                      </b>
                      <span className="text-xs text-white/40">{t("ქულა", "points", "очков")}</span>
                    </span>
                  </div>
                  <span className="block h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <span className="block h-full rounded-full" style={{ width: `${Math.max(3, (r.points / maxPoints) * 100)}%`, background: medal ?? "#fbbf24" }} />
                  </span>
                </button>
                {expanded && (
                  <ul className="mt-1.5 flex flex-col gap-1 rounded-2xl border border-white/10 bg-black/20 p-2">
                    {!players[r.city] ? (
                      <li className="h-16 animate-pulse rounded-xl bg-white/[0.06]" />
                    ) : (
                      players[r.city].map((p, k) => (
                        <li key={p.id}>
                          <Link href={p.id === userId ? "/profile" : `/players/${p.id}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/[0.06]">
                            <span className="w-6 text-center text-sm font-bold tabular-nums text-white/40">{k + 1}</span>
                            <Avatar size="sm" color={p.avatar_color} icon={p.avatar_icon} url={p.avatar_url} frame={p.equipped_frame ?? undefined} />
                            <span className="min-w-0 flex-1 truncate font-bold">
                              <Nick name={p.nickname} style={p.equipped_name} />
                            </span>
                            <b className="tabular-nums text-amber-200">{p.score}</b>
                          </Link>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
