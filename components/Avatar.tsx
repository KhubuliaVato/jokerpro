export const AVATAR_COLORS: Record<string, string> = {
  amber: "from-amber-300 to-orange-500",
  sky: "from-sky-300 to-blue-500",
  rose: "from-rose-300 to-pink-500",
  violet: "from-violet-300 to-purple-500",
  emerald: "from-emerald-300 to-teal-500",
  slate: "from-slate-300 to-slate-500",
};
export const AVATAR_ICONS = ["♠", "♥", "♣", "♦", "★", "♛"];

const SIZES = {
  sm: "size-9 text-lg",
  md: "size-12 text-2xl",
  lg: "size-24 text-5xl",
  xl: "size-32 text-6xl sm:size-40 sm:text-7xl",
} as const;

/** A round player avatar: the uploaded photo, or a gradient colour plus a card-suit style icon. */
export function Avatar({
  color,
  icon,
  url,
  size = "md",
}: {
  color?: string;
  icon?: string;
  /** Uploaded photo; replaces the colour + icon when present. */
  url?: string | null;
  size?: keyof typeof SIZES;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className={`flex-none rounded-full object-cover shadow-inner ring-2 ring-white/30 ${SIZES[size]}`}
      />
    );
  }
  return (
    <span
      className={`grid flex-none place-items-center rounded-full bg-gradient-to-br font-extrabold leading-none text-black/75 shadow-inner ring-2 ring-white/30 ${SIZES[size]} ${AVATAR_COLORS[color ?? ""] ?? AVATAR_COLORS.amber}`}
    >
      {icon ?? "♠"}
    </span>
  );
}
