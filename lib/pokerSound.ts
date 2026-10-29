/**
 * Poker table sounds, made with the Web Audio API (no sound files): chips, cards, check, fold, a win.
 * Every call is silent while the sound is off or the browser has not allowed audio yet.
 */
const KEY = "poker-sound";

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let on: boolean | null = null;

export function soundOn(): boolean {
  if (on === null) {
    try {
      on = typeof localStorage === "undefined" || localStorage.getItem(KEY) !== "off";
    } catch {
      on = true;
    }
  }
  return on;
}

export function setSoundOn(v: boolean) {
  on = v;
  try {
    localStorage.setItem(KEY, v ? "on" : "off");
  } catch {
    // remembering the choice is optional
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !soundOn()) return null;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** A burst of filtered noise: the body of every swish and click. */
function burst(c: AudioContext, at: number, dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = "bandpass") {
  if (!noise) return;
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.012, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(at, Math.random() * 0.5, dur + 0.02);
}

/** A short pitched ring that fades out. */
function tone(c: AudioContext, at: number, freq: number, dur: number, gain: number, type: OscillatorType = "sine", to?: number) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** One chip landing on another. */
function click(c: AudioContext, at: number, gain = 0.5) {
  const f = 2600 + Math.random() * 1600;
  burst(c, at, 0.035, f, 7, gain);
  tone(c, at, f * 0.9, 0.06, gain * 0.25, "triangle");
}

/** A handful of chips: `n` clicks scattered over a short moment. */
export function playChips(n = 4) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < n; i++) click(c, t + i * 0.045 + Math.random() * 0.03, 0.35 + Math.random() * 0.25);
}

/** A big pile of chips pushed across the felt, for the pot being paid out. */
export function playChipsSlide() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  burst(c, t, 0.45, 1400, 0.8, 0.12);
  for (let i = 0; i < 9; i++) click(c, t + 0.05 + i * 0.05 + Math.random() * 0.03, 0.3 + Math.random() * 0.3);
}

/** A card slid across the table. */
export function playDeal() {
  const c = audio();
  if (!c) return;
  burst(c, c.currentTime, 0.1, 1900, 1.2, 0.22);
}

/** A card turned over. */
export function playFlip() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  burst(c, t, 0.07, 2800, 1.5, 0.2);
  burst(c, t + 0.05, 0.03, 900, 3, 0.15);
}

/** Two knuckles on the wood. */
export function playCheck() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  for (const d of [0, 0.13]) {
    tone(c, t + d, 190, 0.09, 0.55, "sine", 95);
    burst(c, t + d, 0.04, 700, 1, 0.25, "lowpass");
  }
}

/** Cards pushed away. */
export function playFold() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  burst(c, t, 0.16, 1100, 0.9, 0.2);
  burst(c, t + 0.06, 0.12, 1700, 0.9, 0.12);
}

/** Your turn: a soft double ping. */
export function playTurn() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  tone(c, t, 880, 0.18, 0.12);
  tone(c, t + 0.11, 1320, 0.22, 0.1);
}

/** A win: a bright run of notes over falling chips. */
export function playWin() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, t + i * 0.09, f, 0.5, 0.14, "triangle"));
  for (let i = 0; i < 12; i++) click(c, t + 0.15 + i * 0.06 + Math.random() * 0.04, 0.25 + Math.random() * 0.25);
}
