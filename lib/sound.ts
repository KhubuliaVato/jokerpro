/** Table sound effects (files live in public/sounds). Each call plays on a fresh element so rapid plays overlap. */
export const DEFAULT_VOLUME = 0.2;

let master = DEFAULT_VOLUME;
const cache = new Map<string, HTMLAudioElement>();

/** Master volume, 0..1. The table sets it to the default at the start of every game. */
export function setMasterVolume(v: number) {
  master = Math.min(1, Math.max(0, v));
}

function play(src: string, gain: number) {
  if (typeof window === "undefined" || master <= 0) return;
  try {
    let base = cache.get(src);
    if (!base) {
      base = new Audio(src);
      base.preload = "auto";
      cache.set(src, base);
    }
    const a = base.cloneNode() as HTMLAudioElement;
    a.volume = Math.min(1, master * gain);
    void a.play().catch(() => {}); // autoplay can be blocked until the first click
  } catch {
    // sound is optional
  }
}

export const playCardSound = () => play("/sounds/card-play.mp3", 1);
export const playDealSound = () => play("/sounds/deal.mp3", 0.85);
