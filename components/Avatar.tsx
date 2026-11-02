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
  /** Opponent tags: small on a phone, the usual size from `sm` up. */
  tag: "size-6 text-sm wide:size-9 wide:text-lg",
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
  frame,
}: {
  color?: string;
  icon?: string;
  /** Uploaded photo; replaces the colour + icon when present. */
  url?: string | null;
  size?: keyof typeof SIZES;
  /** A shop frame (id of the item) drawn around the avatar. */
  frame?: string | null;
}) {
  const face = <AvatarFace color={color} icon={icon} url={url} size={size} />;
  if (!frame) return face;
  return (
    <span className={`avf avf-${frame}`} style={{ ["--avf-w" as string]: FRAME_WIDTH[size] }}>
      {face}
    </span>
  );
}

const FRAME_WIDTH = { tag: "2px", sm: "3px", md: "3px", lg: "5px", xl: "6px" } as const;

function AvatarFace({ color, icon, url, size = "md" }: { color?: string; icon?: string; url?: string | null; size?: keyof typeof SIZES }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className={`avatar-face flex-none rounded-full object-cover shadow-inner ring-2 ring-white/30 ${SIZES[size]}`}
      />
    );
  }
  return (
    <span
      className={`avatar-face grid flex-none place-items-center rounded-full bg-gradient-to-br font-extrabold leading-none text-black/75 shadow-inner ring-2 ring-white/30 ${SIZES[size]} ${AVATAR_COLORS[color ?? ""] ?? AVATAR_COLORS.amber}`}
    >
      {icon ?? "♠"}
    </span>
  );
}
