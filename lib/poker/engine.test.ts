import { describe, expect, it } from "vitest";
import { BOTS } from "../joker/botProfiles";
import { botAct, equity, pokerStyleFor } from "./bot";
import { act, createGame, DEFAULT_CONFIG, HUMAN, nextHand, optionsFor, potOf, type PokerConfig, type PokerState } from "./engine";
import type { NormalCard, Suit } from "../joker/cards";

/** A deterministic random generator (mulberry32). */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const card = (text: string): NormalCard => {
  const rankOf: Record<string, number> = { J: 11, Q: 12, K: 13, A: 14 };
  const suit = text.slice(-1) as Suit;
  const r = text.slice(0, -1);
  return { joker: false, suit, rank: (rankOf[r] ?? Number(r)) as NormalCard["rank"], id: text };
};

const chipsOf = (s: PokerState) => s.seats.reduce((sum, p) => sum + p.stack + (s.phase === "betting" ? p.invested : 0), 0);

/** Plays whole games with the bots in every seat (few simulations, to keep the test quick). */
function playOut(config: PokerConfig, seed: number, maxHands = 40) {
  const rng = seeded(seed);
  let s = createGame(config, rng);
  const chips = config.players * config.startStack;
  let moves = 0;
  while (s.phase !== "gameEnd" && s.handNo <= maxHands) {
    if (s.phase === "handEnd") {
      expect(s.seats.reduce((sum, p) => sum + p.stack, 0)).toBe(chips);
      s = nextHand(s, rng);
      continue;
    }
    const style = { ...pokerStyleFor(BOTS[s.turn % BOTS.length]), sims: 6 };
    s = act(s, botAct(s, style, rng), rng);
    expect(chipsOf(s)).toBe(chips);
    if (++moves > 20000) throw new Error("game does not end");
  }
  return s;
}

describe("dealing a hand", () => {
  it("posts the blinds, deals two cards each, and the seat after the big blind acts first", () => {
    const s = createGame({ ...DEFAULT_CONFIG, players: 6 }, seeded(1));
    expect(s.seats.every((p) => p.hole.length === 2)).toBe(true);
    expect(s.smallBlindSeat).toBe((s.dealer + 1) % 6);
    expect(s.bigBlindSeat).toBe((s.dealer + 2) % 6);
    expect(s.seats[s.smallBlindSeat].bet).toBe(10);
    expect(s.seats[s.bigBlindSeat].bet).toBe(20);
    expect(s.turn).toBe((s.dealer + 3) % 6);
    expect(potOf(s)).toBe(30);
    expect(s.currentBet).toBe(20);
    expect(s.community).toHaveLength(0);
  });

  it("heads up the dealer is the small blind and acts first before the flop", () => {
    const s = createGame({ ...DEFAULT_CONFIG, players: 2 }, seeded(2));
    expect(s.smallBlindSeat).toBe(s.dealer);
    expect(s.turn).toBe(s.dealer);
    expect(s.bigBlindSeat).toBe((s.dealer + 1) % 2);
  });
});

describe("betting", () => {
  it("everybody calling and checking deals flop, turn and river, then shows down", () => {
    let s = createGame({ ...DEFAULT_CONFIG, players: 3 }, seeded(3));
    const lengths: number[] = [];
    for (let guard = 0; guard < 60 && s.phase === "betting"; guard++) {
      if (lengths[lengths.length - 1] !== s.community.length) lengths.push(s.community.length);
      s = act(s, optionsFor(s).canCheck ? { type: "check" } : { type: "call" });
    }
    expect(lengths).toEqual([0, 3, 4, 5]);
    expect(s.phase).toBe("handEnd");
    expect(s.result?.showdown).toBe(true);
    expect(s.seats.reduce((sum, p) => sum + p.stack, 0)).toBe(3 * 1000);
  });

  it("the big blind gets the option to raise when everybody just calls", () => {
    let s = createGame({ ...DEFAULT_CONFIG, players: 3 }, seeded(4));
    s = act(s, { type: "call" }); // dealer
    s = act(s, { type: "call" }); // small blind completes
    expect(s.phase).toBe("betting");
    expect(s.turn).toBe(s.bigBlindSeat);
    expect(optionsFor(s).canCheck).toBe(true);
    expect(optionsFor(s).canRaise).toBe(true);
  });

  it("enforces the minimum raise and a raise reopens the betting", () => {
    let s = createGame({ ...DEFAULT_CONFIG, players: 3 }, seeded(5));
    const o = optionsFor(s);
    expect(o.minRaiseTo).toBe(40); // 20 plus a raise of at least 20
    expect(() => act(s, { type: "raise", to: 30 })).toThrow();
    s = act(s, { type: "raise", to: 100 });
    expect(s.currentBet).toBe(100);
    expect(s.minRaise).toBe(80);
    expect(optionsFor(s).minRaiseTo).toBe(180);
  });

  it("everybody else folding gives the pot to the last player, no showdown", () => {
    let s = createGame({ ...DEFAULT_CONFIG, players: 3 }, seeded(6));
    s = act(s, { type: "raise", to: 60 });
    s = act(s, { type: "fold" });
    s = act(s, { type: "fold" });
    expect(s.phase).toBe("handEnd");
    expect(s.result?.showdown).toBe(false);
    expect(s.result?.payouts[0].amount).toBe(60 + 10 + 20);
  });

  it("an all-in call ends the betting and runs the board out", () => {
    let s = createGame({ ...DEFAULT_CONFIG, players: 2 }, seeded(7));
    const o = optionsFor(s);
    s = act(s, { type: "raise", to: o.maxRaiseTo });
    s = act(s, { type: "call" });
    expect(s.phase).toBe("handEnd");
    expect(s.community).toHaveLength(5);
    expect(s.seats.reduce((sum, p) => sum + p.stack, 0)).toBe(2000);
  });
});

describe("side pots", () => {
  it("a short stack can only win what it covered", () => {
    const rng = seeded(11);
    let s = createGame({ ...DEFAULT_CONFIG, players: 3 }, rng);
    const short = s.turn;
    s.seats[short].stack = 50;
    const chips = s.seats.reduce((sum, p) => sum + p.stack + p.invested, 0);
    for (let guard = 0; guard < 100 && s.phase === "betting"; guard++) {
      const o = optionsFor(s);
      s = act(s, o.canRaise && guard < 6 ? { type: "raise", to: o.maxRaiseTo } : o.toCall > 0 ? { type: "call" } : { type: "check" }, rng);
    }
    expect(s.phase).toBe("handEnd");
    expect(s.seats.reduce((sum, p) => sum + p.stack, 0)).toBe(chips);
    const win = s.result!.payouts.find((p) => p.seat === short)?.amount ?? 0;
    expect(win).toBeLessThanOrEqual(3 * s.seats[short].invested);
  });

  it("splits a tied pot three ways when the board plays for everybody", () => {
    const rng = seeded(12);
    let s = createGame({ ...DEFAULT_CONFIG, players: 3 }, rng);
    const royal = ["10S", "JS", "QS", "KS", "AS"];
    s.deck = [...royal.map(card), ...s.deck.filter((c) => !royal.includes(c.id))];
    for (const p of s.seats) p.hole = [card("2C"), card("3D")];
    for (let guard = 0; guard < 40 && s.phase === "betting"; guard++) s = act(s, optionsFor(s).canCheck ? { type: "check" } : { type: "call" }, rng);
    expect(s.phase).toBe("handEnd");
    expect(s.result!.payouts).toHaveLength(3);
    expect(s.result!.payouts.map((p) => p.amount)).toEqual([20, 20, 20]);
  });
});

describe("equity", () => {
  it("aces are a big favourite against one random hand, 7-2 offsuit an underdog", () => {
    const rng = seeded(1);
    expect(equity([card("AS"), card("AH")], [], 1, 400, rng)).toBeGreaterThan(0.8);
    expect(equity([card("7S"), card("2H")], [], 1, 400, rng)).toBeLessThan(0.42);
  });

  it("a made flush on the river wins almost always", () => {
    const board = [card("2S"), card("7S"), card("9S"), card("KD"), card("3C")];
    expect(equity([card("AS"), card("4S")], board, 3, 300, seeded(2))).toBeGreaterThan(0.85);
  });
});

describe("whole games", () => {
  it("keeps the chips constant over many hands", () => {
    for (let seed = 1; seed <= 12; seed++) playOut({ ...DEFAULT_CONFIG, players: 2 + (seed % 5) }, seed);
  });

  it("a game ends when somebody has all the chips or the human is broke", () => {
    let ended = 0;
    for (let seed = 200; seed < 215; seed++) {
      const s = playOut({ ...DEFAULT_CONFIG, players: 3, startStack: 200 }, seed, 300);
      if (s.phase === "gameEnd") {
        ended++;
        const alive = s.seats.filter((p) => !p.out);
        expect(s.winner === null ? s.seats[HUMAN].out : alive.length === 1).toBe(true);
      }
    }
    expect(ended).toBeGreaterThan(10);
  });

  it("deals no card twice", () => {
    const rng = seeded(9);
    for (let i = 0; i < 20; i++) {
      const s = createGame({ ...DEFAULT_CONFIG, players: 2 + (i % 5) }, rng);
      const ids = [...s.seats.flatMap((p) => p.hole.map((c) => c.id)), ...s.deck.map((c) => c.id)];
      expect(new Set(ids).size).toBe(52);
    }
  });
});
