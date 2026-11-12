"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { RANKS } from "@/lib/ranks";
import { computeStats, placeCounts, type GameResult } from "@/lib/stats";
import { getSupabase } from "@/lib/supabase";
import { PlaceMedal, PLACE_LOOK } from "./PlaceMedal";
import { Panel } from "./ProfileWidgets";

const WEEKDAYS: [string, string, string][] = [
  ["ორშ", "Mon", "Пн"],
  ["სამ", "Tue", "Вт"],
  ["ოთხ", "Wed", "Ср"],
  ["ხუთ", "Thu", "Чт"],
  ["პარ", "Fri", "Пт"],
  ["შაბ", "Sat", "Сб"],
  ["კვი", "Sun", "Вс"],
];

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);

/** Wins in a row from the newest game back (results are newest first). */
function currentStreak(rows: GameResult[]): number {
  let n = 0;
  for (const r of rows) {
    if (r.place !== 1) break;
    n++;
  }
  return n;
}

function longestStreak(rows: GameResult[]): number {
  let best = 0;
  let run = 0;
  for (const r of [...rows].reverse()) {
    run = r.place === 1 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-white/[0.08] to-white/[0.02] px-4 py-4" style={{ borderColor: `${tone}33` }}>
      <div className="pointer-events-none absolute -right-6 -top-8 size-20 rounded-full blur-2xl" style={{ background: `${tone}26` }} />
      <span className="relative block text-[0.68rem] font-extrabold uppercase tracking-wider text-white/45">{label}</span>
      <b className="relative mt-1 block text-3xl font-black tabular-nums leading-none sm:text-4xl" style={{ color: tone }}>
        {value}
      </b>
      {note && <span className="relative mt-1.5 block text-xs text-white/45">{note}</span>}
    </div>
  );
}

/** The last games as coins in the colour of the place, newest on the right. */
function Form({ rows }: { rows: GameResult[] }) {
  const t = useT();
  const last = rows.slice(0, 12).reverse();
  const streak = currentStreak(rows);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {last.map((r) => {
          const look = PLACE_LOOK[r.place];
          return (
            <span
              key={r.id}
              className="grid size-8 place-items-center rounded-full text-xs font-black"
              style={look ? { background: look.face, color: look.text, boxShadow: look.glow } : { background: "rgb(255 255 255 / 0.07)", color: "rgb(255 255 255 / 0.55)", boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.12)" }}
              title={`${r.place} ${t("ადგილი", "place", "место")} · ${r.score} · ${formatDate(new Date(r.played_at))}`}
            >
              {r.place}
            </span>
          );
        })}
      </div>
      <p className="mt-2.5 text-sm text-white/50">
        {streak > 0 ? (
          <>
            {t("მიმდინარე სერია", "Current streak", "Текущая серия")}: <b className="text-amber-300">{streak}</b> {t("გამარჯვება ზედიზედ", "wins in a row", "побед подряд")}
          </>
        ) : (
          t("ბოლო თამაში გამარჯვებით არ დასრულებულა", "The last game was not a win", "Последняя игра без победы")
        )}
      </p>
    </div>
  );
}

/** The rating after every ranked game, with the ranks it crossed. */
function RatingChart({ rows }: { rows: GameResult[] }) {
  const t = useT();
  const points = [...rows].reverse().flatMap((r) => (r.rating_after != null ? [r.rating_after] : []));
  if (points.length < 2) {
    return <p className="py-6 text-center text-sm text-white/45">{t("რეიტინგის გრაფიკი გამოჩნდება მე-2 რეიტინგული თამაშის შემდეგ", "The rating chart appears after the 2nd ranked game", "График рейтинга появится после 2-й рейтинговой игры")}</p>;
  }
  const W = 360;
  const H = 150;
  const pad = 14;
  const lo = Math.min(...points) - 6;
  const hi = Math.max(...points) + 6;
  const x = (i: number) => pad + (i / (points.length - 1)) * (W - pad * 2 - 36);
  const y = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (H - pad * 2);
  const line = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - pad} L${x(0).toFixed(1)},${H - pad} Z`;
  const ranks = RANKS.filter((r) => r.min > lo && r.min < hi);
  const end = points.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full overflow-visible" role="img" aria-label={t("რეიტინგის გრაფიკი", "Rating chart", "График рейтинга")}>
      <defs>
        <linearGradient id="rate-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ranks.map((r) => (
        <g key={r.name}>
          <line x1={pad} x2={W - pad - 34} y1={y(r.min)} y2={y(r.min)} stroke={r.accent} strokeOpacity="0.35" strokeDasharray="3 5" />
          <text x={W - pad - 30} y={y(r.min) + 3.5} fontSize="9.5" fontWeight="700" fill={r.accent} fillOpacity="0.85">
            {r.name}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#rate-fill)" />
      <path d={line} fill="none" stroke="#7dd3fc" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(end)} cy={y(points[end])} r="5" fill="#7dd3fc" stroke="#0b1a2a" strokeWidth="2" />
      <text x={x(end)} y={y(points[end]) - 10} fontSize="11" fontWeight="800" textAnchor="middle" fill="#e0f2fe">
        {points[end]}
      </text>
    </svg>
  );
}

/** One bar per game (oldest left), coloured by the place, with the average as a dashed line. */
function ScoreBars({ rows }: { rows: GameResult[] }) {
  const t = useT();
  const list = rows.slice(0, 20).reverse();
  if (list.length < 2) return <p className="py-6 text-center text-sm text-white/45">{t("გრაფიკი გამოჩნდება მე-2 თამაშის შემდეგ", "The chart appears after the 2nd game", "График появится после 2-й игры")}</p>;
  const max = Math.max(1, ...list.map((r) => r.score));
  const avg = list.reduce((s, r) => s + r.score, 0) / list.length;
  return (
    <div>
      <div className="relative flex h-40 items-end gap-1.5">
        <span className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/25" style={{ bottom: `${Math.max(0, (avg / max) * 100)}%` }}>
          <span className="absolute -top-4 right-0 rounded bg-black/40 px-1 text-[0.65rem] font-bold tabular-nums text-white/60">{t("საშ.", "avg", "ср.")} {Math.round(avg)}</span>
        </span>
        {list.map((r) => {
          const look = PLACE_LOOK[r.place];
          return (
            <span
              key={r.id}
              className="min-w-0 flex-1 rounded-t-md"
              style={{ height: `${Math.max(4, (Math.max(0, r.score) / max) * 100)}%`, background: look ? `linear-gradient(180deg, ${look.tone}, ${look.tone}66)` : "linear-gradient(180deg, rgb(255 255 255 / 0.35), rgb(255 255 255 / 0.1))" }}
              title={`${r.score} · ${r.place} ${t("ადგილი", "place", "место")} · ${formatDate(new Date(r.played_at))}`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-white/40">
        <span>{t("ადრე", "Earlier", "Раньше")}</span>
        <span>{t("ბოლო", "Latest", "Последний")}: <b className="text-white/80">{list[list.length - 1].score}</b></span>
      </div>
    </div>
  );
}

function PlaceSplit({ rows }: { rows: GameResult[] }) {
  const counts = placeCounts(rows);
  const total = rows.length;
  const max = Math.max(1, ...counts);
  return (
    <ul className="flex flex-col gap-3">
      {counts.map((n, i) => (
        <li key={i} className="flex items-center gap-3">
          <PlaceMedal place={i + 1} size={2.1} />
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${(n / max) * 100}%`, background: PLACE_LOOK[i + 1]?.tone ?? "#64748b" }} />
          </span>
          <b className="w-8 flex-none text-right text-base tabular-nums">{n}</b>
          <span className="w-10 flex-none text-right text-sm tabular-nums text-white/45">{pct(n, total)}%</span>
        </li>
      ))}
    </ul>
  );
}

/** Games, wins and the average place by how they were played. */
function Modes({ rows }: { rows: GameResult[] }) {
  const t = useT();
  const groups: { label: string; rows: GameResult[]; tone: string }[] = [
    { label: t("რეიტინგული", "Ranked", "Рейтинговые"), rows: rows.filter((r) => r.kind === "ranked"), tone: "#fbbf24" },
    { label: t("მეგობრული", "Friendly", "Дружеские"), rows: rows.filter((r) => r.kind === "friendly"), tone: "#7dd3fc" },
    { label: t("კერძო", "Private", "Частные"), rows: rows.filter((r) => r.online && !r.kind), tone: "#c4b5fd" },
    { label: t("ბოტებთან", "Against bots", "С ботами"), rows: rows.filter((r) => !r.online), tone: "#94a3b8" },
  ].filter((g) => g.rows.length > 0);
  return (
    <ul className="flex flex-col gap-2.5">
      {groups.map((g) => {
        const s = computeStats(g.rows);
        return (
          <li key={g.label} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 gap-y-1 rounded-xl bg-white/[0.04] px-4 py-2.5">
            <b className="text-sm font-extrabold" style={{ color: g.tone }}>{g.label}</b>
            <span className="text-right text-sm tabular-nums text-white/70">{g.rows.length} <span className="text-white/35">{t("თამ.", "games", "игр")}</span></span>
            <span className="text-right text-sm tabular-nums text-white/70">{s.winRate}% <span className="text-white/35">{t("მოგ.", "wins", "побед")}</span></span>
            <span className="text-right text-sm tabular-nums text-white/70">{s.avgPlace?.toFixed(1)} <span className="text-white/35">{t("ადგ.", "avg", "место")}</span></span>
          </li>
        );
      })}
    </ul>
  );
}

/** Which weekday and which part of the day the games fall on. */
function WhenYouPlay({ rows }: { rows: GameResult[] }) {
  const t = useT();
  const week = Array<number>(7).fill(0);
  const parts = Array<number>(4).fill(0);
  for (const r of rows) {
    const d = new Date(r.played_at);
    week[(d.getDay() + 6) % 7]++;
    parts[Math.floor(d.getHours() / 6)]++;
  }
  const wmax = Math.max(1, ...week);
  const pmax = Math.max(1, ...parts);
  const names: [string, string, string][] = [
    ["ღამე", "Night", "Ночь"],
    ["დილა", "Morning", "Утро"],
    ["დღე", "Day", "День"],
    ["საღამო", "Evening", "Вечер"],
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex h-28 items-end gap-2">
        {week.map((n, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={`${t(...WEEKDAYS[i])}: ${n}`}>
            <span className="w-full rounded-t-md bg-gradient-to-t from-amber-500/60 to-amber-300" style={{ height: `${Math.max(4, (n / wmax) * 100)}%`, opacity: n ? 1 : 0.25 }} />
            <span className="text-[0.68rem] font-bold text-white/50">{t(...WEEKDAYS[i])}</span>
          </div>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {parts.map((n, i) => (
          <li key={i} className="rounded-xl bg-white/[0.04] px-3 py-2">
            <span className="block text-[0.65rem] font-extrabold uppercase tracking-wider text-white/40">{t(...names[i])}</span>
            <b className="text-lg font-extrabold tabular-nums">{pct(n, rows.length)}%</b>
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full bg-sky-300" style={{ width: `${(n / pmax) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A calendar of the last twelve weeks: the more games a day, the brighter. */
function Heatmap({ rows }: { rows: GameResult[] }) {
  const t = useT();
  const [today] = useState(() => new Date());
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(dayKey(new Date(r.played_at)), (counts.get(dayKey(new Date(r.played_at))) ?? 0) + 1);
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const weeks = 12;
  const cells: { date: Date; n: number; future: boolean }[][] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const col: { date: Date; n: number; future: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - w * 7 + d);
      col.push({ date, n: counts.get(dayKey(date)) ?? 0, future: date > today });
    }
    cells.push(col);
  }
  const max = Math.max(1, ...cells.flat().map((c) => c.n));
  const total = cells.flat().reduce((s, c) => s + c.n, 0);
  return (
    <div>
      <div className="flex gap-1.5">
        <div className="flex flex-col justify-between py-0.5 text-[0.6rem] font-bold text-white/35">
          {[0, 2, 4, 6].map((i) => (
            <span key={i}>{t(...WEEKDAYS[i])}</span>
          ))}
        </div>
        <div className="flex flex-1 gap-1.5">
          {cells.map((col, i) => (
            <div key={i} className="flex flex-1 flex-col gap-1.5">
              {col.map((c) => (
                <span
                  key={dayKey(c.date)}
                  className="aspect-square w-full rounded-[5px]"
                  title={c.future ? undefined : `${formatDate(c.date)}: ${c.n}`}
                  style={{ background: c.future ? "transparent" : c.n === 0 ? "rgb(255 255 255 / 0.06)" : `rgb(251 191 36 / ${0.3 + (c.n / max) * 0.7})`, boxShadow: c.n > 0 ? `0 0 10px -3px rgb(251 191 36 / ${(c.n / max) * 0.8})` : undefined }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-white/45">
        {total} {t("თამაში ბოლო 12 კვირაში", "games in the last 12 weeks", "игр за последние 12 недель")}
      </p>
    </div>
  );
}

interface PlayStyle {
  games: number;
  hands: number;
  hits: number;
  khishtis: number;
  best: number;
  points: number;
  streak: number;
}

/** How the player plays Joker: figures of the hands, from the database (null for games without them). */
function PlayStyleCard({ userId }: { userId: string }) {
  const t = useT();
  const [state, setState] = useState<{ userId: string; data: PlayStyle | null } | null>(null);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let off = false;
    supabase.rpc("player_play_stats", { p_user: userId, p_game: "joker" }).then(({ data, error }) => {
      if (!off) setState({ userId, data: !error && data && (data as PlayStyle).hands > 0 ? (data as PlayStyle) : null });
    });
    return () => {
      off = true;
    };
  }, [userId]);
  const s = state && state.userId === userId ? state.data : null;
  if (!s) return null;
  const hitRate = pct(s.hits, s.hands);
  const item = (label: string, value: string, note: string, tone: string) => (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5">
      <span className="block text-[0.68rem] font-extrabold uppercase tracking-wider text-white/45">{label}</span>
      <b className="mt-1 block text-3xl font-black tabular-nums leading-none" style={{ color: tone }}>{value}</b>
      <span className="mt-1.5 block text-xs text-white/45">{note}</span>
    </div>
  );
  return (
    <Panel title={t("როგორ თამაშობთ ჯოკერს", "How you play Joker", "Как вы играете в Джокер")}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {item(t("ზუსტი ნათქვამი", "Bids kept", "Заказы выполнены"), `${hitRate}%`, `${s.hits} / ${s.hands} ${t("ხელი", "hands", "раздач")}`, "#6ee7b7")}
        {item(t("საშუალო ქულა ხელზე", "Points per hand", "Очков за раздачу"), String(Math.round(s.points / Math.max(1, s.hands))), `${s.games} ${t("თამაშიდან", "games", "игр")}`, "#fbbf24")}
        {item(t("საუკეთესო ხელი", "Best hand", "Лучшая раздача"), `+${s.best}`, t("ერთ ხელში", "in one hand", "за одну раздачу"), "#7dd3fc")}
        {item(t("სტრიკი", "Best run", "Серия"), String(s.streak), s.khishtis > 0 ? `${s.khishtis} ${t("ხიშტი", "khishtis", "хишти")}` : t("ხიშტის გარეშე", "no khishtis", "без хишти"), "#c4b5fd")}
      </div>
      <p className="mt-3 text-xs text-white/40">{t("ბოლო 100 ონლაინ თამაშის მიხედვით", "From the latest 100 online games", "По последним 100 онлайн-играм")}</p>
    </Panel>
  );
}

/** The whole stats page of one game. */
export function StatsDashboard({ rows, userId, gameId }: { rows: GameResult[]; userId: string; gameId: string }) {
  const t = useT();
  const s = computeStats(rows);
  const podium = rows.filter((r) => r.place <= 3).length;
  const streak = longestStreak(rows);

  if (rows.length === 0) {
    return (
      <Panel>
        <p className="py-4 text-center text-white/50">{t("სტატისტიკა გამოჩნდება პირველი დასრულებული თამაშის შემდეგ.", "Stats appear after the first finished game.", "Статистика появится после первой завершённой игры.")}</p>
      </Panel>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label={t("თამაში", "Games", "Игры")} value={String(s.played)} tone="#fcd34d" />
        <Kpi label={t("მოგება", "Win rate", "Побед")} value={`${s.winRate}%`} note={`${s.wins} ${t("გამარჯვება", "wins", "побед")}`} tone="#34d399" />
        <Kpi label={t("პრიზიორი", "Podium", "Призовые")} value={`${pct(podium, s.played)}%`} note={`${podium} / ${s.played}`} tone="#e2e8f0" />
        <Kpi label={t("საშუალო ადგილი", "Avg. place", "Среднее место")} value={s.avgPlace?.toFixed(1) ?? "—"} tone="#7dd3fc" />
        <Kpi label={t("საუკეთესო ქულა", "Best score", "Лучший счёт")} value={s.best === null ? "—" : String(s.best)} tone="#f472b6" />
        <Kpi label={t("საუკეთესო სერია", "Best streak", "Лучшая серия")} value={String(streak)} note={t("გამარჯვება ზედიზედ", "wins in a row", "побед подряд")} tone="#fb923c" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("ფორმა", "Form", "Форма")}>
          <Form rows={rows} />
          <div className="mt-6 border-t border-white/10 pt-5">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/45">{t("რეიტინგი", "Rating", "Рейтинг")}</h3>
            <RatingChart rows={rows} />
          </div>
        </Panel>
        <Panel title={t("ქულა თამაშების მიხედვით", "Score by game", "Очки по играм")}>
          <ScoreBars rows={rows} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("ადგილები", "Places", "Места")}>
          <PlaceSplit rows={rows} />
        </Panel>
        <Panel title={t("რეჟიმები", "Modes", "Режимы")}>
          <Modes rows={rows} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("როდის თამაშობთ", "When you play", "Когда вы играете")}>
          <WhenYouPlay rows={rows} />
        </Panel>
        <Panel title={t("აქტივობა", "Activity", "Активность")}>
          <Heatmap rows={rows} />
        </Panel>
      </div>

      {gameId === "joker" && <PlayStyleCard userId={userId} />}
    </div>
  );
}
