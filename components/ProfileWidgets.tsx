import type { GameInfo } from "@/lib/games";
import { useT } from "@/lib/i18n";
import type { Achievement } from "@/lib/stats";

const PLACE_COLORS = ["#fcd34d", "#cbd5e1", "#fb923c", "#64748b"];

/** Soft card used by every widget on the profile. */
export function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-7 ${className}`}>
      {title && <h2 className="mb-5 text-sm font-bold uppercase tracking-wider text-white/45">{title}</h2>}
      {children}
    </section>
  );
}

/** Win-rate ring. */
export function Donut({ percent, label }: { percent: number; label: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-36 flex-none">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="11" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#fcd34d"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - percent / 100)}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <b className="block text-3xl font-extrabold tabular-nums">{percent}%</b>
          <span className="text-xs text-white/45">{label}</span>
        </div>
      </div>
    </div>
  );
}

/** How often each place was taken. */
export function PlaceBars({ counts }: { counts: number[] }) {
  const t = useT();
  const max = Math.max(1, ...counts);
  return (
    <ul className="flex min-w-0 flex-1 flex-col gap-3">
      {counts.map((n, i) => (
        <li key={i} className="flex items-center gap-3">
          <span className="w-20 flex-none whitespace-nowrap text-sm text-white/55">{t(`${i + 1} ადგილი`, `Place ${i + 1}`, `${i + 1} место`)}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${(n / max) * 100}%`, background: PLACE_COLORS[i] }}
            />
          </span>
          <b className="w-6 flex-none text-right text-sm tabular-nums">{n}</b>
        </li>
      ))}
    </ul>
  );
}

/** Scores of the last games, oldest on the left. */
export function Sparkline({ values }: { values: number[] }) {
  const t = useT();
  if (values.length < 2) {
    return (
      <div className="flex h-36 flex-col items-center justify-center gap-3 text-center">
        <svg viewBox="0 0 160 40" className="h-10 w-40 text-white/15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 7" aria-hidden>
          <path d="M4 32 C30 30 40 12 70 18 S120 6 156 8" />
        </svg>
        <p className="text-sm text-white/45">
          {t("გრაფიკი გამოჩნდება მე-2 თამაშის შემდეგ", "The chart appears after the 2nd game", "График появится после 2-й игры")}
          <b className="ml-1.5 text-white/70">{values.length}/2</b>
        </p>
      </div>
    );
  }
  const W = 320;
  const H = 120;
  const pad = 10;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (values.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2);
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(values.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  const last = values.length - 1;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full overflow-visible" role="img" aria-label={t("ბოლო თამაშების ქულები", "Scores of recent games", "Очки последних игр")}>
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fcd34d" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#fcd34d" stopOpacity="0" />
          </linearGradient>
        </defs>
        {min < 0 && (
          <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke="rgb(255 255 255 / 0.18)" strokeDasharray="4 5" />
        )}
        <path d={area} fill="url(#spark-fill)" />
        <path d={line} fill="none" stroke="#fcd34d" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(last)} cy={y(values[last])} r="5" fill="#fcd34d" stroke="#0a2418" strokeWidth="2" />
      </svg>
      <div className="mt-2 flex justify-between text-xs text-white/40">
        <span>{t("ადრე", "Earlier", "Раньше")}</span>
        <span>
          {t("ბოლო", "Latest", "Последний")}: <b className="text-white/80">{values[last]}</b>
        </span>
      </div>
    </div>
  );
}

/** Unlocked and locked achievements, each with how far the player is. */
export function Achievements({ items }: { items: Achievement[] }) {
  const t = useT();
  const done = items.filter((a) => a.done).length;
  return (
    <Panel title={`${t("მიღწევები", "Achievements", "Достижения")} · ${done}/${items.length}`}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((a) => (
          <li
            key={a.id}
            title={a.hint}
            className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-center ${
              a.done ? "border-amber-300/50 bg-amber-300/10 shadow-[0_14px_34px_-22px_rgb(252_211_77/0.8)]" : "border-white/10 bg-white/[0.02]"
            }`}
          >
            <span
              className={`grid size-12 place-items-center rounded-full text-2xl ${
                a.done ? "bg-amber-300 text-black" : "bg-white/10 text-white/40"
              }`}
            >
              {a.icon}
            </span>
            <span className={`text-sm font-bold leading-tight ${a.done ? "" : "text-white/70"}`}>{a.title}</span>
            <span className="text-[0.7rem] leading-tight text-white/45">{a.hint}</span>
            {!a.done && (
              <span className="mt-auto w-full">
                <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full bg-amber-300/80" style={{ width: `${(a.progress.value / a.progress.max) * 100}%` }} />
                </span>
                <span className="mt-1 block text-[0.7rem] tabular-nums text-white/45">
                  {a.progress.value}/{a.progress.max}
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** One pill per game: the profile shows the stats (and the rank) of the selected one. */
export function GameTabs({
  games,
  value,
  onChange,
}: {
  games: GameInfo[];
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useT();
  return (
    <div role="tablist" aria-label={t("თამაში", "Game", "Игра")} className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-bold uppercase tracking-wider text-white/45">{t("თამაში", "Game", "Игра")}</span>
      <div className="flex flex-wrap gap-2 rounded-full border border-white/10 bg-black/20 p-1.5">
        {games.map((g) => (
          <button
            key={g.id}
            role="tab"
            aria-selected={g.id === value}
            onClick={() => onChange(g.id)}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-base font-bold transition-[background-color,color] duration-200 ${
              g.id === value ? "bg-amber-300 text-black" : "text-white/60 hover:text-white"
            }`}
          >
            <span>{g.icon}</span>
            {g.name}
          </button>
        ))}
        <span className="hidden items-center rounded-full px-4 py-2 text-sm text-white/25 sm:flex">{t("მალე სხვა თამაშებიც", "More games soon", "Скоро будут другие игры")}</span>
      </div>
    </div>
  );
}
