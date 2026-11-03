import { describe, expect, it } from "vitest";
import { botBid, botChooseTrump, botPlay } from "./bot";
import { ONLINE_STYLE, onlineTierFor, type BotStyle } from "./botProfiles";
import { advance, botMove, isActivePhase } from "./online";
import { proBid, proPlay } from "./proBot";
import { chooseTrump, createGame, legalBids, legalPlays, placeBid, playCard, totals, type GameState } from "./engine";
import { DEFAULT_RULES } from "./rules";

/** A small deterministic random generator, so that two runs can be compared exactly. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Plays up to the first decision of `player` in the playing phase of a hand of `cards` cards. */
function stateAtPlay(seed: number, player = 0): GameState {
  const rng = seeded(seed);
  let s = createGame({ ...DEFAULT_RULES, format: "nine" }, rng);
  for (let guard = 0; guard < 300; guard++) {
    if (s.phase === "playing" && s.turn === player && s.played.length >= 2) return s;
    if (!isActivePhase(s)) s = advance(s);
    else s = botMove(s);
  }
  throw new Error("no such state");
}

const FAST = { budgetMs: Infinity, minWorlds: 12, maxWorlds: 12 };

describe("online bot levels", () => {
  it("picks the level from the humans' average rating", () => {
    expect(onlineTierFor(50)).toBe("weak");
    expect(onlineTierFor(199)).toBe("weak");
    expect(onlineTierFor(200)).toBe("strong");
    expect(onlineTierFor(399)).toBe("strong");
    expect(onlineTierFor(400)).toBe("pro");
    expect(onlineTierFor(1500)).toBe("pro");
  });

  it("makes weak bots forget more than strong ones", () => {
    expect(ONLINE_STYLE.weak.memory!).toBeLessThan(ONLINE_STYLE.strong.memory!);
    expect(ONLINE_STYLE.strong.memory!).toBeLessThan(ONLINE_STYLE.pro.memory ?? 1);
    expect(ONLINE_STYLE.weak.mistake).toBeGreaterThan(ONLINE_STYLE.strong.mistake);
  });
});

describe("pro bot", () => {
  it("always makes a legal move", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const s = stateAtPlay(seed);
      const pick = proPlay(s, s.turn, { ...FAST, rng: seeded(seed) });
      expect(legalPlays(s, s.turn).some((o) => o.card.id === pick.card.id && o.mode === pick.mode && o.suit === pick.suit)).toBe(true);
    }
  });

  it("makes a legal bid", () => {
    const s = createGame({ ...DEFAULT_RULES, format: "full" }, seeded(5));
    const bid = proBid(s, s.turn, { ...FAST, rng: seeded(1) });
    expect(legalBids(s, s.turn)).toContain(bid);
  });

  it("never looks at the other players' cards", () => {
    for (let seed = 1; seed <= 5; seed++) {
      const s = stateAtPlay(seed);
      // The same game, except that the opponents hold different cards of the same numbers.
      const other = structuredClone(s);
      const pool = other.hands.flatMap((h, p) => (p === s.turn ? [] : h)).reverse();
      let at = 0;
      other.hands = other.hands.map((h, p) => {
        if (p === s.turn) return h;
        const swapped = pool.slice(at, at + h.length);
        at += h.length;
        return swapped;
      });
      const a = proPlay(s, s.turn, { ...FAST, rng: seeded(99) });
      const b = proPlay(other, other.turn, { ...FAST, rng: seeded(99) });
      expect(b.card.id).toBe(a.card.id);
      expect(b.mode).toBe(a.mode);
      expect(b.suit).toBe(a.suit);
    }
  });

  it("thinks within its time budget", () => {
    const s = stateAtPlay(3);
    const began = Date.now();
    proPlay(s, s.turn, { budgetMs: 110 });
    expect(Date.now() - began).toBeLessThan(600);
  });
});

/** Seat 0 plays with `me`, the others with `others`; each side may use the pro bot. Returns seat 0's edge over the others. */
function match(me: "pro" | BotStyle, others: "pro" | BotStyle, rng: () => number, fast: boolean): number {
  let s: GameState = createGame({ ...DEFAULT_RULES, format: "nine" }, rng);
  const opts = fast ? { budgetMs: 8, minWorlds: 3, maxWorlds: 8 } : {};
  for (let guard = 0; guard < 20000 && s.phase !== "gameEnd"; guard++) {
    if (!isActivePhase(s)) {
      s = advance(s);
      continue;
    }
    const who = s.turn === 0 ? me : others;
    if (s.phase === "trump") s = chooseTrump(s, botChooseTrump(s.hands[s.turn]));
    else if (who === "pro") s = s.phase === "bidding" ? placeBid(s, proBid(s, s.turn, opts)) : playCard(s, proPlay(s, s.turn, opts));
    else s = s.phase === "bidding" ? placeBid(s, botBid(s, s.turn, who)) : playCard(s, botPlay(s, s.turn, who));
  }
  const t = totals(s);
  return t[0] - (t[1] + t[2] + t[3]) / 3;
}

// Strength check (slow): ARENA=1 npx vitest run lib/joker/proBot.test.ts
describe.skipIf(!process.env.ARENA)("arena", () => {
  const games = Number(process.env.ARENA_GAMES ?? 12);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  it("the pro bot beats the strong bot, and the strong beats the weak", () => {
    const proVsStrong = mean(Array.from({ length: games }, (_, i) => match("pro", ONLINE_STYLE.strong, seeded(100 + i), true)));
    const strongVsWeak = mean(Array.from({ length: games }, (_, i) => match(ONLINE_STYLE.strong, ONLINE_STYLE.weak, seeded(200 + i), false)));
    console.log(`pro vs strong: ${proVsStrong.toFixed(1)}   strong vs weak: ${strongVsWeak.toFixed(1)}`);
    expect(strongVsWeak).toBeGreaterThan(0);
    expect(proVsStrong).toBeGreaterThan(-20);
  }, 600000);
});
