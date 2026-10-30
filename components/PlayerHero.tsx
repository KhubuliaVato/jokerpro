import { useT } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import type { PlayerSummary } from "@/lib/search";
import { Avatar } from "./Avatar";
import { rise } from "./ui";

/** Big card at the top of a player's page: photo, name, membership date and optional actions. */
export function PlayerHero({
  player,
  subtitle,
  children,
}: {
  player: PlayerSummary | null;
  /** Shown before the membership date (e.g. the e-mail on one's own profile). */
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const t = useT();
  return (
    <section
      className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-6 sm:p-10"
      style={rise(1)}
    >
      <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-amber-300/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 bottom-[-6rem] size-64 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="relative flex flex-col gap-7 sm:flex-row sm:items-center">
        <div className="relative flex-none">
          <div className="absolute inset-0 scale-125 rounded-full bg-amber-300/20 blur-2xl" />
          <Avatar size="xl" color={player?.avatar_color} icon={player?.avatar_icon} url={player?.avatar_url} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-4xl font-extrabold tracking-tight sm:text-6xl">{player?.nickname ?? "…"}</h1>
          <p className="mt-1 truncate text-base text-white/50">
            {subtitle}
            {subtitle && player && " · "}
            {player && <>{t(`წევრია ${formatDate(new Date(player.created_at))}-დან`, `Member since ${formatDate(new Date(player.created_at))}`, `Участник с ${formatDate(new Date(player.created_at))}`)}</>}
          </p>
        </div>
        {children && <div className="flex gap-3 sm:flex-col">{children}</div>}
      </div>
    </section>
  );
}
