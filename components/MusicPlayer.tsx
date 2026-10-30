"use client";

import { tt, useLang } from "@/lib/i18n";
import { useCallback, useEffect, useRef, useState } from "react";

/** Music for the background, from the free Audius catalogue: no sign-in, no ads. */
const API = "https://api.audius.co/v1";
const APP = "ProJoker";

/** Genres to pick from: the name Audius knows, and its label for the player. */
const GENRE_DATA: { id: string; names: [string, string, string] }[] = [
  { id: "", names: ["პოპულარული", "Popular", "Популярное"] },
  { id: "Hip-Hop/Rap", names: ["ჰიპ-ჰოპი", "Hip-Hop / Rap", "Хип-хоп / Рэп"] },
  { id: "Lo-Fi", names: ["ლოუ-ფაი", "Lo-Fi", "Лоу-фай"] },
  { id: "Electronic", names: ["ელექტრონული", "Electronic", "Электронная"] },
  { id: "R&B/Soul", names: ["R&B / სოულ", "R&B / Soul", "R&B / Соул"] },
  { id: "Jazz", names: ["ჯაზი", "Jazz", "Джаз"] },
  { id: "Pop", names: ["პოპი", "Pop", "Поп"] },
  { id: "Rock", names: ["როკი", "Rock", "Рок"] },
  { id: "Ambient", names: ["ემბიენტი", "Ambient", "Эмбиент"] },
  { id: "Funk", names: ["ფანკი", "Funk", "Фанк"] },
  { id: "Blues", names: ["ბლუზი", "Blues", "Блюз"] },
  { id: "Classical", names: ["კლასიკური", "Classical", "Классика"] },
  { id: "Latin", names: ["ლათინო", "Latin", "Латино"] },
  { id: "Reggae", names: ["რეგი", "Reggae", "Регги"] },
];

const GENRES: { id: string; label: string }[] = GENRE_DATA.map((g) => ({
  id: g.id,
  get label() {
    return tt(...g.names);
  },
}));

interface Track {
  id: string;
  title: string;
  artist: string;
  art: string | null;
}

interface AudiusTrack {
  id: string;
  title: string;
  user?: { name?: string };
  artwork?: { "150x150"?: string } | null;
  is_streamable?: boolean;
}

async function fetchTracks(query: string, genre: string): Promise<Track[]> {
  const params = new URLSearchParams({ limit: "30", app_name: APP });
  let url: string;
  if (query) {
    params.set("query", query);
    if (genre) params.set("genre", genre);
    url = `${API}/tracks/search?${params}`;
  } else {
    params.set("time", "month");
    if (genre) params.set("genre", genre);
    url = `${API}/tracks/trending?${params}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  const body = (await res.json()) as { data?: AudiusTrack[] };
  return (body.data ?? [])
    .filter((t) => t.is_streamable !== false)
    .map((t) => ({ id: t.id, title: t.title, artist: t.user?.name ?? "", art: t.artwork?.["150x150"] ?? null }));
}

const streamUrl = (id: string) => `${API}/tracks/${id}/stream?app_name=${APP}`;

const clock = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

const CTRL = "grid size-9 flex-none place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30";

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
      <path d={d} />
    </svg>
  );
}
/** The round glass buttons of the table's header. */
export const ROUND_BTN =
  "grid size-9 place-items-center rounded-full border border-amber-200/20 bg-gradient-to-b from-white/[0.12] to-black/30 text-white/75 shadow-[inset_0_1px_0_rgb(255_255_255/0.15),0_2px_8px_rgb(0_0_0/0.4)] transition-[color,border-color,box-shadow,transform] hover:border-amber-300/60 hover:text-amber-200 active:scale-95";
export const NOTE = "M9 17.5V6.2a1 1 0 0 1 .76-.97l8-2A1 1 0 0 1 19 4.2v11.3a3 3 0 1 1-2-2.83V7.5l-6 1.5v8.5a3 3 0 1 1-2-2.83Z";
export { Icon };

/** A speaker with sound waves, or crossed out when the sound is off. */
export function SpeakerIcon({ off }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4H4Z" fill="currentColor" stroke="none" />
      {off ? <path d="m16 9.5 5 5M21 9.5l-5 5" /> : <path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.7a7.5 7.5 0 0 1 0 10.6" />}
    </svg>
  );
}
const PLAY ="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z";
const PAUSE = "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z";
const PREV = "M6 5h2v14H6zM20 5.7v12.6a.8.8 0 0 1-1.25.66L9.6 12.66a.8.8 0 0 1 0-1.32l9.15-6.3A.8.8 0 0 1 20 5.7Z";
const NEXT = "M16 5h2v14h-2zM4 5.7v12.6a.8.8 0 0 0 1.25.66l9.15-6.3a.8.8 0 0 0 0-1.32L5.25 5.04A.8.8 0 0 0 4 5.7Z";

export function MusicPlayer() {
  useLang(); // genre names follow the language
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<string | null>(null);
  const [listed, setListed] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [time, setTime] = useState({ now: 0, total: 0 });
  const audio = useRef<HTMLAudioElement | null>(null);
  const tracksRef = useRef<Track[]>([]);
  const indexRef = useRef(-1);
  const volumeRef = useRef(0.4);
  useEffect(() => {
    tracksRef.current = tracks;
    indexRef.current = index;
    volumeRef.current = volume;
  }, [tracks, index, volume]);

  const play = useCallback((i: number) => {
    const list = tracksRef.current;
    const a = audio.current;
    if (!a || i < 0 || i >= list.length) return;
    a.src = streamUrl(list[i].id);
    a.volume = volumeRef.current;
    indexRef.current = i;
    setIndex(i);
    void a.play().catch(() => setPlaying(false));
  }, []);

  // One audio element for the whole life of the player; a track that cannot be played is skipped.
  useEffect(() => {
    const a = new Audio();
    audio.current = a;
    a.onplay = () => setPlaying(true);
    a.onpause = () => setPlaying(false);
    a.ontimeupdate = () => setTime({ now: a.currentTime, total: a.duration });
    a.onended = () => play((indexRef.current + 1) % Math.max(1, tracksRef.current.length));
    a.onerror = () => {
      if (a.src && tracksRef.current.length > 1) play((indexRef.current + 1) % tracksRef.current.length);
    };
    return () => {
      a.pause();
      a.removeAttribute("src");
      audio.current = null;
    };
  }, [play]);

  const load = useCallback(async (q: string, g: string) => {
    setListed(true);
    setStatus("loading");
    try {
      const found = await fetchTracks(q.trim(), g);
      tracksRef.current = found;
      setTracks(found);
      // the song that is playing stays in the list if it is there, otherwise the list starts over
      const playingId = audio.current?.src ? tracksRef.current.findIndex((t) => audio.current?.src.includes(t.id)) : -1;
      setIndex(playingId);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, []);

  // A genre shows its songs; pressing the open genre again folds the list away.
  const pickGenre = (g: string) => {
    if (genre === g && listed) {
      setGenre(null);
      setListed(false);
      return;
    }
    setGenre(g);
    void load(query, g);
  };

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (!a.src) play(Math.max(0, index));
    else if (a.paused) void a.play().catch(() => {});
    else a.pause();
  };
  const step = (d: number) => {
    const n = tracks.length;
    if (n > 0) play((((index < 0 ? 0 : index) + d) % n + n) % n);
  };
  const setVol = (v: number) => {
    setVolume(v);
    if (audio.current) audio.current.volume = v;
  };
  const seek = (v: number) => {
    const a = audio.current;
    if (a && Number.isFinite(a.duration)) a.currentTime = v;
  };

  const current = tracks[index];
  const progress = time.total > 0 ? (time.now / time.total) * 100 : 0;

  return (
    <div className="relative">
      <button
        className={`${ROUND_BTN} ${playing || open ? "!border-amber-300/70 !text-amber-200 shadow-[0_0_14px_rgb(232_196_106/0.35)]" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={tt("მუსიკა", "Music", "Музыка")}
      >
        <Icon d={NOTE} />
      </button>
      {open && <button type="button" aria-label={tt("დახურვა", "Close", "Закрыть")} className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />}
      {open && (
        <div className="pk-up-bar pk-scroll fixed inset-x-3 top-12 z-40 flex max-h-[calc(100dvh-4rem)] flex-col overflow-y-auto rounded-3xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[21rem] border border-amber-200/15 bg-[linear-gradient(160deg,rgb(38_16_20/0.96),rgb(14_8_10/0.97))] text-sm shadow-[0_24px_60px_rgb(0_0_0/0.65),inset_0_1px_0_rgb(255_255_255/0.08)] backdrop-blur-xl">
          {/* what is playing */}
          <div className="flex items-center gap-3 px-4 pb-3 pt-4">
            <div className="relative size-14 flex-none overflow-hidden rounded-2xl bg-white/10 shadow-[0_6px_18px_rgb(0_0_0/0.5)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {current?.art ? <img src={current.art} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-2xl text-white/40">♪</span>}
            </div>
            <div className="min-w-0 flex-1">
              <b className="block truncate text-base leading-tight">{current ? current.title : tt("აირჩიეთ სიმღერა", "Choose a song", "Выберите песню")}</b>
              <span className="block truncate text-xs text-white/55">{current ? current.artist : tt("ჟანრი ან ძიება ქვემოთ", "Pick a genre or search below", "Выберите жанр или поиск ниже")}</span>
            </div>
            {playing && (
              <span aria-hidden className="pk-eq flex h-4 flex-none items-end gap-[2px]">
                <i />
                <i />
                <i />
              </span>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={tt("დახურვა", "Close", "Закрыть")}
              className="grid size-8 flex-none place-items-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-1 px-4">
            <input
              type="range"
              min={0}
              max={Number.isFinite(time.total) && time.total > 0 ? time.total : 1}
              step={0.5}
              value={Math.min(time.now, Number.isFinite(time.total) ? time.total : 0)}
              onChange={(e) => seek(Number(e.target.value))}
              disabled={!current}
              aria-label={tt("დაკვრის პოზიცია", "Playback position", "Позиция воспроизведения")}
              className="pk-range w-full"
              style={{ "--p": `${progress}%` } as React.CSSProperties}
            />
            <div className="flex justify-between text-[0.65rem] tabular-nums text-white/45">
              <span>{clock(time.now)}</span>
              <span>{clock(time.total)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 px-3 pb-2">
            <button className={CTRL} onClick={() => step(-1)} disabled={tracks.length === 0} aria-label={tt("წინა", "Previous", "Назад")}>
              <Icon d={PREV} />
            </button>
            <button
              className="grid size-11 flex-none place-items-center rounded-full bg-amber-300 text-black shadow-[0_4px_16px_rgb(232_196_106/0.35)] transition-transform hover:scale-105 disabled:opacity-40"
              onClick={toggle}
              disabled={tracks.length === 0}
              aria-label={playing ? tt("პაუზა", "Pause", "Пауза") : tt("დაკვრა", "Play", "Играть")}
            >
              <Icon d={playing ? PAUSE : PLAY} />
            </button>
            <button className={CTRL} onClick={() => step(1)} disabled={tracks.length === 0} aria-label={tt("შემდეგი", "Next", "Вперёд")}>
              <Icon d={NEXT} />
            </button>
            <span aria-hidden className="ml-auto text-white/40">
              <SpeakerIcon off={volume === 0} />
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVol(Number(e.target.value))}
              aria-label={tt("მუსიკის ხმა", "Music volume", "Громкость музыки")}
              className="pk-range w-20 flex-none"
              style={{ "--p": `${volume * 100}%` } as React.CSSProperties}
            />
          </div>

          {/* genres and search */}
          <div className="border-t border-white/10 px-4 pb-3 pt-3">
            <div className="pk-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2">
              {GENRES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => pickGenre(g.id)}
                  aria-pressed={genre === g.id}
                  className={`flex-none rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                    genre === g.id ? "border-amber-300 bg-amber-300 text-black" : "border-white/15 text-white/70 hover:border-white/40"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void load(query, genre ?? "");
              }}
              className="relative"
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tt("სიმღერა ან არტისტი…", "Song or artist…", "Песня или исполнитель…")}
                className="w-full rounded-full border border-white/10 bg-white/[0.06] py-2 pl-4 pr-16 outline-none transition-colors placeholder:text-white/35 focus:border-amber-300/70"
              />
              <button type="submit" className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold hover:bg-white/20">
                {tt("ძიება", "Search", "Поиск")}
              </button>
            </form>
          </div>

          {listed && (
          <ul className="pk-scroll flex max-h-52 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
            {status === "loading" && <li className="px-2 py-4 text-center text-white/55">{tt("იძებნება…", "Searching…", "Поиск…")}</li>}
            {status === "error" && <li className="px-2 py-4 text-center text-red-200">{tt("ძიება ვერ მოხერხდა, სცადეთ ხელახლა", "Search failed, try again", "Поиск не удался, попробуйте снова")}</li>}
            {status === "idle" && tracks.length === 0 && <li className="px-2 py-4 text-center text-white/55">{tt("ვერაფერი მოიძებნა", "Nothing found", "Ничего не найдено")}</li>}
            {status === "idle" &&
              tracks.map((t, i) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => play(i)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/[0.07] ${i === index ? "bg-white/[0.09]" : ""}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {t.art ? <img src={t.art} alt="" className="size-9 flex-none rounded-lg object-cover" /> : <span className="size-9 flex-none rounded-lg bg-white/10" />}
                    <span className="min-w-0 flex-1">
                      <b className={`block truncate text-[0.82rem] ${i === index ? "text-amber-200" : ""}`}>{t.title}</b>
                      <span className="block truncate text-xs text-white/45">{t.artist}</span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
          )}
          <p className="pb-2 text-center text-[0.62rem] tracking-wide text-white/30">{tt("მუსიკა", "Music", "Музыка")}: Audius</p>
        </div>
      )}
    </div>
  );
}
