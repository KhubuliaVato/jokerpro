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

// ---- sound packs from the shop: the same two sounds, made with Web Audio ----

let pack: string | null = null;
let ctx: AudioContext | null = null;

/** The pack this player has put on (null: the standard sounds). */
export function setSoundPack(id: string | null) {
  pack = id;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || master <= 0) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(c: AudioContext, at: number, freq: number, dur: number, gain: number, type: OscillatorType, to?: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * master), at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function noise(c: AudioContext, at: number, dur: number, freq: number, q: number, gain: number) {
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(Math.max(0.0002, gain * master), at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(at);
}

/** One card landing, in the given pack. */
function synthCard(id: string) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  if (id === "s_wood") {
    tone(c, t, 190, 0.14, 1.6, "sine", 70);
    noise(c, t, 0.05, 1100, 1.2, 1.3);
  } else if (id === "s_soft") {
    noise(c, t, 0.16, 2400, 0.7, 1.0);
    tone(c, t, 260, 0.1, 0.35, "sine", 180);
  } else if (id === "s_arcade") {
    tone(c, t, 520, 0.07, 0.55, "square", 880);
    tone(c, t + 0.07, 880, 0.08, 0.45, "square");
  } else if (id === "s_sakura") {
    // a plucked string, then a second, higher one: a koto
    tone(c, t, 659, 0.5, 0.9, "triangle", 650);
    tone(c, t + 0.07, 988, 0.45, 0.55, "triangle", 975);
    noise(c, t, 0.03, 3000, 2, 0.35);
  } else if (id === "s_carbon") {
    // a hard mechanical click with a short low thud under it
    noise(c, t, 0.04, 4200, 3, 1.3);
    tone(c, t, 120, 0.1, 1.2, "square", 55);
  } else if (id === "s_ice") {
    // glass ticking against glass: three high, short tones and a crackle
    tone(c, t, 2093, 0.3, 0.5, "sine");
    tone(c, t + 0.03, 3136, 0.25, 0.35, "sine");
    tone(c, t + 0.06, 4186, 0.18, 0.2, "sine");
    noise(c, t, 0.03, 6500, 4, 0.5);
  } else if (id === "s_night") {
    // a music box: two soft, ringing notes of a lullaby
    tone(c, t, 1047, 0.7, 0.55, "sine");
    tone(c, t + 0.09, 1319, 0.65, 0.4, "sine");
    tone(c, t, 2093, 0.3, 0.12, "sine");
  } else if (id === "s_matrix") {
    // a quick chirp of three square-wave blips, like data going down a wire
    tone(c, t, 1568, 0.05, 0.4, "square");
    tone(c, t + 0.05, 1175, 0.05, 0.4, "square");
    tone(c, t + 0.1, 1760, 0.07, 0.4, "square", 880);
    noise(c, t, 0.02, 5000, 3, 0.4);
  } else if (id === "s_crystal") {
    tone(c, t, 1320, 0.45, 0.6, "sine");
    tone(c, t + 0.02, 1976, 0.4, 0.4, "sine");
    tone(c, t + 0.05, 2637, 0.3, 0.2, "sine");
  }
}

export const playCardSound = () => (pack ? synthCard(pack) : play("/sounds/card-play.mp3", 1));
export const playDealSound = () => {
  if (!pack) return play("/sounds/deal.mp3", 0.85);
  for (let i = 0; i < 4; i++) setTimeout(() => synthCard(pack ?? ""), i * 90);
};

/** Lets the shop and the inventory play a pack before it is bought or put on. */
export function previewSoundPack(id: string) {
  if (master <= 0) master = DEFAULT_VOLUME;
  synthCard(id);
}
