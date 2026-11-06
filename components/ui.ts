import { tt } from "@/lib/i18n";
import type { CSSProperties } from "react";

/** Flat text field used by the sign-in and profile forms. */
export const INPUT =
  "w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-lg text-white placeholder:text-white/30 outline-none transition-[border-color,background-color] duration-200 focus:border-amber-300 focus:bg-white/[0.07]";

/** Main action: solid gold pill. */
export const BTN_PRIMARY =
  "rounded-full bg-amber-300 px-8 py-3.5 text-lg font-extrabold text-black transition-[transform,background-color,opacity] duration-200 hover:-translate-y-0.5 hover:bg-amber-200 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0";

/** Secondary action: outlined pill. */
export const BTN_GHOST =
  "rounded-full border border-white/20 px-6 py-2.5 text-base font-bold transition-[border-color,color,background-color] duration-200 hover:border-amber-300 hover:text-amber-300 disabled:opacity-50";

/** Georgian labels for the game formats. */
export const FORMAT_LABEL = {
  get full() {
    return tt("სტანდარტული", "Standard", "Стандартная");
  },
  get nine() {
    return tt("ცხრიანები", "Nines", "Девятки");
  },
  get p2() {
    return tt("2 მოთამაშე", "2 players", "2 игрока");
  },
  get p4() {
    return tt("4 მოთამაშე", "4 players", "4 игрока");
  },
} as const;

/** Keyframes for {@link rise}; render once per page inside a <style> tag. */
export const RISE_CSS = "@keyframes menu-rise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}";

/** Staggered entrance: block `i` rises into place a little after the previous one. */
export const rise = (i: number): CSSProperties => ({
  animation: "menu-rise 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both",
  animationDelay: `${80 + i * 110}ms`,
});

/** The round buttons and pills of the site header: a soft gradient, an amber edge and a lift on hover. */
export const HEADER_BTN =
  "rounded-xl border border-white/[0.09] bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-[0_6px_16px_-12px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.06)] transition-[border-color,translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-amber-300/50 hover:shadow-[0_10px_26px_-12px_rgb(252_211_77/0.45)] focus-visible:border-amber-300";

/** The drop-down panels of the header: dark in the colour of the chosen theme. */
export const HEADER_MENU =
  "absolute right-0 top-14 z-40 overflow-hidden rounded-2xl border border-white/15 bg-[var(--bg-b)] p-1.5 shadow-[0_24px_50px_-16px_rgb(0_0_0/0.8)]";
