import { describe, expect, it } from "vitest";
import { botBid, botChooseTrump, botPlay } from "./bot";
import { buildDeck, type Card, type Suit } from "./cards";
import {
  chooseTrump,
  createGame,
  finishTrick,
  legalBids,
  legalPlays,
  nextHand,
  placeBid,
  playCard,
  totals,
  trickWinner,
  type GameState,
  type JokerMode,
  type Play,
} from "./engine";
import { DEFAULT_RULES, handPoints, schedule } from "./rules";

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const card = (suit: Suit, rank: number): Card => ({
  joker: false,
  suit,
  rank: rank as 6,
  id: `${suit}${rank}`,
});
const joker = (n: 0 | 1): Card => ({ joker: true, id: `J${n}` });
const play = (
  player: number,
  c: Card,
  mode?: JokerMode,
  suit?: Suit,
): Play => ({ player, card: c, mode, suit });

describe("deck", () => {
  it("has 34 cards plus two jokers and no black sixes", () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(36);
    expect(deck.filter((c) => c.joker)).toHaveLength(2);
    expect(deck.some((c) => c.id === "S6" || c.id === "C6")).toBe(false);
    expect(new Set(deck.map((c) => c.id)).size).toBe(36);
  });
});

describe("schedule", () => {
  it("full game is 24 hands, nine-card game is 16", () => {
    expect(schedule("full").flat()).toHaveLength(24);
    expect(schedule("nine").flat()).toHaveLength(16);
  });
});

describe("scoring", () => {
  const r = DEFAULT_RULES;
  it("made bid, full bid, pass, miss and khishti", () => {
    expect(handPoints(2, 2, 9, r)).toBe(150);
    expect(handPoints(9, 9, 9, r)).toBe(900);
    expect(handPoints(3, 3, 3, r)).toBe(300);
    expect(handPoints(0, 0, 5, r)).toBe(50);
    expect(handPoints(0, 2, 5, r)).toBe(20);
    expect(handPoints(1, 2, 9, r)).toBe(20);
    expect(handPoints(3, 1, 9, r)).toBe(10);
    // a khishti costs double in the nine-card hands
    expect(handPoints(2, 0, 9, r)).toBe(-400);
    expect(handPoints(2, 0, 8, r)).toBe(-200);
    expect(handPoints(1, 0, 1, r)).toBe(-200);
  });
});

describe("trick winner", () => {
  it("highest trump beats the led suit", () => {
    const plays = [
      play(0, card("S", 14)),
      play(1, card("H", 7)),
      play(2, card("S", 13)),
      play(3, card("H", 6)),
    ];
    expect(trickWinner(plays, "H")).toBe(1);
    expect(trickWinner(plays, "D")).toBe(0);
    expect(trickWinner(plays, null)).toBe(0);
  });

  it("a high joker takes the trick, the later high joker wins", () => {
    const plays = [
      play(0, card("H", 14)),
      play(1, joker(0), "high"),
      play(2, card("H", 13)),
      play(3, joker(1), "high"),
    ];
    expect(trickWinner(plays, "H")).toBe(3);
    plays[3] = play(3, joker(1), "low");
    expect(trickWinner(plays, "H")).toBe(1);
  });

  it("a low joker never wins when others follow", () => {
    const plays = [
      play(0, card("S", 7)),
      play(1, joker(0), "low"),
      play(2, card("S", 6)),
      play(3, card("D", 14)),
    ];
    expect(trickWinner(plays, null)).toBe(0);
  });

  it("leader keeps a trick led with a low joker when nobody follows", () => {
    const plays = [
      play(0, joker(0), "low", "S"),
      play(1, card("D", 14)),
      play(2, card("H", 13)),
      play(3, card("D", 9)),
    ];
    expect(trickWinner(plays, "C")).toBe(0);
    expect(trickWinner(plays, "D")).toBe(1);
  });
});

function stateWith(hands: Card[][], trump: Suit | null, trick: Play[]) {
  const s = createGame(DEFAULT_RULES, seeded(1));
  return {
    ...s,
    phase: "playing",
    hands,
    trump,
    trick,
    turn: trick.length,
  } as GameState;
}

describe("legal plays", () => {
  it("must follow suit, then trump, otherwise anything", () => {
    const trick = [play(0, card("S", 10))];
    const follow = stateWith(
      [[], [card("S", 7), card("H", 14)], [], []],
      "H",
      trick,
    );
    expect(legalPlays(follow, 1).map((o) => o.card.id)).toEqual(["S7"]);

    const ruff = stateWith(
      [[], [card("D", 7), card("H", 8)], [], []],
      "H",
      trick,
    );
    expect(legalPlays(ruff, 1).map((o) => o.card.id)).toEqual(["H8"]);

    const free = stateWith(
      [[], [card("D", 7), card("C", 8)], [], []],
      "H",
      trick,
    );
    expect(legalPlays(free, 1)).toHaveLength(2);
  });

  it("a joker may always be played, high or low", () => {
    const trick = [play(0, card("S", 10))];
    const s = stateWith([[], [card("S", 7), joker(0)], [], []], null, trick);
    const opts = legalPlays(s, 1);
    expect(opts.filter((o) => o.card.joker).map((o) => o.mode)).toEqual([
      "high",
      "low",
    ]);
  });

  it("a high joker lead forces the highest card of the named suit", () => {
    const trick = [play(0, joker(0), "high", "S")];
    const s = stateWith(
      [[], [card("S", 7), card("S", 12), card("S", 9)], [], []],
      null,
      trick,
    );
    expect(legalPlays(s, 1).map((o) => o.card.id)).toEqual(["S12"]);
    const low = stateWith(
      [[], [card("S", 7), card("S", 12)], [], []],
      null,
      [play(0, joker(0), "low", "S")],
    );
    expect(legalPlays(low, 1)).toHaveLength(2);
  });

  it("leading a joker offers every suit in both modes", () => {
    const s = stateWith([[joker(0)], [], [], []], null, []);
    expect(legalPlays(s, 0)).toHaveLength(8);
  });
});

describe("bidding", () => {
  it("the dealer may not make the bids add up to the card count", () => {
    let s = createGame(DEFAULT_RULES, seeded(7));
    while (s.cards !== 3) {
      s = playHand(s, seeded(3));
      s = nextHand(s, seeded(4));
    }
    s = placeBid(s, 1);
    s = placeBid(s, 1);
    s = placeBid(s, 0);
    expect(s.turn).toBe(s.dealer);
    expect(legalBids(s, s.dealer)).toEqual([0, 2, 3]);
    expect(() => placeBid(s, 1)).toThrow();
  });
});

/** Plays one hand to the end with bots. */
function playHand(start: GameState, rng: () => number): GameState {
  let s = start;
  for (let guard = 0; guard < 500; guard++) {
    if (s.phase === "handEnd" || s.phase === "gameEnd") return s;
    if (s.phase === "trump") s = chooseTrump(s, botChooseTrump(s.hands[s.turn]));
    else if (s.phase === "bidding") s = placeBid(s, botBid(s, s.turn));
    else if (s.phase === "playing") s = playCard(s, botPlay(s, s.turn));
    else s = finishTrick(s);
  }
  void rng;
  throw new Error("hand did not finish");
}

describe("full bot games", () => {
  for (const format of ["full", "nine"] as const) {
    it(`finishes a ${format} game with consistent state`, () => {
      const rng = seeded(format === "full" ? 11 : 12);
      let s = createGame({ ...DEFAULT_RULES, format }, rng);
      const expectedHands = schedule(format).flat().length;
      for (let i = 0; i < expectedHands; i++) {
        const dealt = s.hands.reduce((n, h) => n + h.length, 0);
        expect(dealt).toBe(s.phase === "trump" ? 12 : s.cards * 4);
        s = playHand(s, rng);
        const row = s.history[s.history.length - 1];
        expect(row.taken.reduce((a, b) => a + b, 0)).toBe(row.cards);
        expect(row.bids.reduce((a, b) => a + b, 0)).not.toBe(row.cards);
        if (s.phase === "handEnd") s = nextHand(s, rng);
      }
      expect(s.phase).toBe("gameEnd");
      expect(s.history).toHaveLength(expectedHands);
      expect(totals(s)).toHaveLength(4);
    });
  }

  it("bots make a reasonable share of their bids", () => {
    let made = 0;
    let total = 0;
    for (let seed = 1; seed <= 15; seed++) {
      const rng = seeded(seed);
      let s = createGame(DEFAULT_RULES, rng);
      for (let i = 0; i < 24; i++) {
        s = playHand(s, rng);
        const row = s.history[s.history.length - 1];
        row.bids.forEach((b, p) => {
          total++;
          if (b === row.taken[p]) made++;
        });
        if (s.phase === "handEnd") s = nextHand(s, rng);
      }
    }
    const rate = made / total;
    console.log(`bot exact-bid rate: ${(rate * 100).toFixed(1)}%`);
    expect(rate).toBeGreaterThan(0.35);
  });
});
