import { useT } from "@/lib/i18n";

/** Metals of the places: first gold, second silver, third bronze, the rest a dark glass coin. */
export const PLACE_LOOK: Record<number, { ring: string; face: string; text: string; glow: string; tone: string }> = {
  1: {
    ring: "linear-gradient(145deg, #fff6c2, #f5b83d 40%, #8a5a0a 62%, #ffe27a)",
    face: "radial-gradient(circle at 32% 25%, #fff3b0, #f2b233 55%, #b9780f)",
    text: "#4a2e04",
    glow: "0 0 20px -2px rgb(251 191 36 / 0.7)",
    tone: "#fbbf24",
  },
  2: {
    ring: "linear-gradient(145deg, #ffffff, #bcc6d1 40%, #5f6b79 62%, #eef1f4)",
    face: "radial-gradient(circle at 32% 25%, #ffffff, #c7d0da 55%, #8793a2)",
    text: "#2a3441",
    glow: "0 0 16px -3px rgb(203 213 225 / 0.6)",
    tone: "#cbd5e1",
  },
  3: {
    ring: "linear-gradient(145deg, #f8cfa6, #c8793a 40%, #6e3a14 62%, #eab07a)",
    face: "radial-gradient(circle at 32% 25%, #f9d2ac, #d0824a 55%, #8f4f22)",
    text: "#3d1d07",
    glow: "0 0 16px -3px rgb(208 138 76 / 0.6)",
    tone: "#d08a4c",
  },
};

const CROWN = (
  <svg viewBox="0 0 24 16" className="absolute -top-[0.62em] left-1/2 w-[0.95em] -translate-x-1/2 drop-shadow" aria-hidden>
    <path d="M2 14L1 4l5.5 4.5L12 1l5.5 7.5L23 4l-1 10z" fill="#fde047" stroke="#a16207" strokeWidth="1" strokeLinejoin="round" />
    <circle cx="12" cy="1.6" r="1.3" fill="#fff7c2" />
  </svg>
);

/** A coin with the place on it: metal ring, a face, and a crown for the winner. `size` is the diameter in rem. */
export function PlaceMedal({ place, size = 3 }: { place: number; size?: number }) {
  const t = useT();
  const look = PLACE_LOOK[place];
  const title = t(`${place} ადგილი`, `Place ${place}`, `${place} место`);
  return (
    <span className="relative inline-grid flex-none place-items-center" style={{ width: `${size}rem`, height: `${size}rem`, fontSize: `${size / 2.6}rem` }} title={title} role="img" aria-label={title}>
      {look && place === 1 && CROWN}
      <span
        className="absolute inset-0 rounded-full"
        style={look ? { background: look.ring, boxShadow: look.glow } : { background: "linear-gradient(145deg, rgb(255 255 255 / 0.3), rgb(255 255 255 / 0.06))" }}
      />
      <span
        className="absolute inset-[9%] grid place-items-center rounded-full font-black leading-none tabular-nums"
        style={
          look
            ? { background: look.face, color: look.text, textShadow: "0 1px 0 rgb(255 255 255 / 0.55)", boxShadow: "inset 0 -2px 4px rgb(0 0 0 / 0.28), inset 0 2px 3px rgb(255 255 255 / 0.5)" }
            : { background: "radial-gradient(circle at 30% 22%, rgb(255 255 255 / 0.14), rgb(30 9 17 / 0.95) 70%)", color: "rgb(255 255 255 / 0.75)", boxShadow: "inset 0 1px 2px rgb(255 255 255 / 0.18)" }
        }
      >
        {place}
      </span>
    </span>
  );
}
