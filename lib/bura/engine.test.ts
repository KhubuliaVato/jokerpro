import { describe, expect, it } from "vitest";
import type { NormalCard, Rank, Suit } from "../joker/cards";
import {
  beats,
  beatsCombo,
  buildDeck,
  cardPoints,
  createGame,
  finishTrick,
  isLegal,
  legalPlays,
  nextRound,
  playCards,
  sumPoints,
  unseenCards,
  type BuraState,
} from "./engine";

const c = (suit: Suit, rank: number): NormalCard => ({ joker: false, suit, rank: rank as Rank, id: `${suit}${rank}` });

/** Deterministic random numbers (mulberry32) so a failing game can be replayed. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A two-player table with the given hands; hearts are trump. */
function table(hands: NormalCard[][], over: Partial<BuraState> = {}): BuraState {
  const base = createGame(hands.length as 2 | 4, rng(1));
  return {
    ...base,
    trump: "H",
    trumpCard: c("H", 6),
    deck: [],
    hands,
    leader: 0,
    turn: 0,
    trick: [],
    best: -1,
    seen: [],
    piles: [0, 0],
    tricks: [0, 0],
    scores: [0, 0],
    phase: "play",
    result: null,
    ...over,
  };
}

describe("cards", () => {
  it("has 36 cards worth 120 points", () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(36);
    expect(sumPoints(deck)).toBe(120);
    expect([14, 10, 13, 12, 11, 9].map(cardPoints)).toEqual([11, 10, 4, 3, 2, 0]);
  });

  it("beats: higher of the same suit, or a trump", () => {
    expect(beats(c("S", 12), c("S", 9), "H")).toBe(true);
    expect(beats(c("S", 9), c("S", 12), "H")).toBe(false);
    expect(beats(c("D", 14), c("S", 6), "H")).toBe(false);
    expect(beats(c("H", 6), c("S", 14), "H")).toBe(true);
    expect(beats(c("H", 6), c("H", 7), "H")).toBe(false);
  });

  it("beatsCombo matches each answer card with a different card", () => {
    expect(beatsCombo([c("S", 14), c("S", 13)], [c("S", 12), c("S", 11)], "H")).toBe(true);
    // one ace cannot beat two cards, and a king beats the nine but not the queen
    expect(beatsCombo([c("S", 14), c("S", 8)], [c("S", 12), c("S", 11)], "H")).toBe(false);
    expect(beatsCombo([c("H", 7), c("S", 14)], [c("S", 12), c("S", 13)], "H")).toBe(true);
    expect(beatsCombo([c("S", 14)], [c("S", 12), c("S", 13)], "H")).toBe(false);
  });
});

describe("deal", () => {
  it("gives three cards each, turns up the trump and puts it under the pile", () => {
    for (const n of [2, 4] as const) {
      const g = createGame(n, rng(7));
      expect(g.hands.map((h) => h.length)).toEqual(Array(n).fill(3));
      expect(g.deck).toHaveLength(36 - n * 3);
      expect(g.deck[g.deck.length - 1]).toEqual(g.trumpCard);
      expect(g.trump).toBe(g.trumpCard.suit);
      expect(g.turn).toBe((g.dealer + 1) % n);
    }
  });
});

describe("leading and answering", () => {
  it("a leader plays one to three cards of one suit", () => {
    const g = table([[c("S", 14), c("S", 10), c("D", 7)], [c("S", 9), c("D", 8), c("C", 6)]]);
    const options = legalPlays(g).map((p) => p.map((x) => x.id).sort().join("+"));
    expect(options).toContain("S10+S14");
    expect(options).toContain("D7");
    expect(options).not.toContain("D7+S14");
    expect(options).not.toContain("D7+S10+S14");
    expect(options).toHaveLength(4); // S14, S10, S10+S14 and D7
  });

  it("the answer has the same size and must beat the lead when that is possible", () => {
    const g = playCards(table([[c("S", 10), c("D", 7), c("C", 6)], [c("S", 14), c("S", 9), c("D", 8)]]), ["S10"]);
    const ids = legalPlays(g).map((p) => p[0].id);
    expect(ids).toEqual(["S14"]);
    expect(isLegal(g, ["S9"])).toBe(false);
  });

  it("trumps are forced when they are the only way to beat", () => {
    const g = playCards(table([[c("S", 14), c("D", 7), c("C", 6)], [c("H", 7), c("S", 9), c("D", 8)]]), ["S14"]);
    expect(legalPlays(g).map((p) => p[0].id)).toEqual(["H7"]);
  });

  it("nothing beats: any cards may be thrown away", () => {
    const g = playCards(table([[c("S", 14), c("D", 7), c("C", 6)], [c("S", 9), c("D", 8), c("C", 7)]]), ["S14"]);
    expect(legalPlays(g)).toHaveLength(3);
  });

  it("a two-card lead has to be answered with two cards that both beat", () => {
    const g = playCards(table([[c("S", 10), c("S", 9), c("D", 6)], [c("S", 14), c("S", 8), c("D", 8)]]), ["S10", "S9"]);
    // S14 beats one card, S8 beats none: nothing beats the pair, so any two cards may be played
    expect(legalPlays(g)).toHaveLength(3);
    const h = playCards(table([[c("S", 10), c("S", 9), c("D", 6)], [c("S", 14), c("S", 13), c("D", 8)]]), ["S10", "S9"]);
    expect(legalPlays(h).map((p) => p.map((x) => x.id).sort().join("+"))).toEqual(["S13+S14"]);
  });

  it("rejects cards that are not in the hand or not allowed", () => {
    const g = table([[c("S", 14), c("D", 7), c("C", 6)], [c("S", 9), c("D", 8), c("C", 7)]]);
    expect(() => playCards(g, ["S14", "D7"])).toThrow("illegal");
    expect(() => playCards(g, ["H14"])).toThrow("illegal");
  });
});

describe("tricks", () => {
  it("the winner takes every card, draws first and leads", () => {
    const deck = [c("D", 14), c("D", 13), c("C", 14), c("H", 6)];
    let g = table([[c("S", 10), c("D", 7), c("C", 6)], [c("S", 14), c("S", 9), c("D", 8)]], { deck, trumpCard: c("H", 6) });
    g = playCards(g, ["S10"]);
    g = playCards(g, ["S14"]);
    expect(g.phase).toBe("trickEnd");
    g = finishTrick(g);
    expect(g.piles).toEqual([0, 21]);
    expect(g.tricks).toEqual([0, 1]);
    expect(g.leader).toBe(1);
    expect(g.turn).toBe(1);
    // seat 1 draws first
    expect(g.hands[1].map((x) => x.id)).toEqual(["S9", "D8", "D14"]);
    expect(g.hands[0].map((x) => x.id)).toEqual(["D7", "C6", "D13"]);
    expect(g.deck.map((x) => x.id)).toEqual(["C14", "H6"]);
  });

  it("the leader keeps the lead when nobody beats", () => {
    let g = table([[c("S", 14), c("D", 7), c("C", 6)], [c("S", 9), c("D", 8), c("C", 7)]]);
    g = playCards(g, ["S14"]);
    g = playCards(g, ["D8"]);
    g = finishTrick(g);
    expect(g.leader).toBe(0);
    expect(g.piles).toEqual([11, 0]);
  });
});

describe("round end", () => {
  /** One trick left in each hand, played so that seat 0 takes it. */
  const last = (piles: number[], tricks: number[]) => {
    const g = table([[c("S", 14)], [c("S", 9)]], { piles, tricks });
    return finishTrick(playCards(playCards(g, ["S14"]), ["S9"]));
  };

  it("61 wins, the loser's points decide how many game points", () => {
    expect(last([50, 59], [3, 3]).result).toMatchObject({ winner: 0, gain: 1 });
    expect(last([50, 40], [3, 3]).result?.piles).toEqual([61, 40]);
    expect(last([50, 40], [3, 3]).scores).toEqual([1, 0]);
    expect(last([50, 20], [3, 3]).result).toMatchObject({ winner: 0, gain: 2 });
    expect(last([50, 0], [3, 0]).result).toMatchObject({ winner: 0, gain: 3 });
  });

  it("60:60 scores nothing and the match goes on", () => {
    const g = last([49, 60], [3, 3]);
    expect(g.result).toMatchObject({ winner: null, gain: 0 });
    expect(g.scores).toEqual([0, 0]);
    expect(g.phase).toBe("roundEnd");
  });

  it("the match ends at the target", () => {
    const g = table([[c("S", 14)], [c("S", 9)]], { piles: [50, 40], tricks: [3, 3], scores: [11, 5] });
    expect(finishTrick(playCards(playCards(g, ["S14"]), ["S9"])).phase).toBe("gameEnd");
  });

  it("the next round is dealt after the dealer changes", () => {
    const g = last([50, 40], [3, 3]);
    const n = nextRound(g, rng(3));
    expect(n.round).toBe(1);
    expect(n.dealer).toBe((g.dealer + 1) % 2);
    expect(n.hands.map((h) => h.length)).toEqual([3, 3]);
    expect(n.scores).toEqual(g.scores);
  });
});

describe("bura", () => {
  it("three trumps in a hand after drawing end the round with four game points", () => {
    const g = table([[c("S", 10), c("D", 7), c("C", 6)], [c("S", 14), c("H", 9), c("H", 7)]], {
      deck: [c("H", 12), c("D", 6), c("C", 8), c("S", 8)],
    });
    // seat 1 wins the trick, draws first and so completes three trumps
    const done = finishTrick(playCards(playCards(g, ["S10"]), ["S14"]));
    expect(done.result).toMatchObject({ winner: 1, gain: 4, bura: 1 });
    expect(done.scores).toEqual([0, 4]);
  });

  it("a dealt hand of three trumps wins at once", () => {
    for (let seed = 1; seed < 4000; seed++) {
      const g = createGame(2, rng(seed));
      if (g.result?.bura !== null && g.result) {
        expect(g.result.gain).toBe(4);
        expect(g.scores[g.result.winner!]).toBe(4);
        expect(g.phase).toBe("roundEnd");
        return;
      }
    }
    throw new Error("no bura found in 4000 deals");
  });
});

describe("four players", () => {
  it("answer in turn; a partner who is winning does not have to be beaten", () => {
    let g = table(
      [
        [c("S", 9), c("D", 7), c("C", 6)],
        [c("S", 10), c("D", 8), c("C", 7)],
        [c("S", 14), c("D", 9), c("C", 8)],
        [c("S", 13), c("S", 12), c("D", 10)],
      ],
    );
    g = playCards(g, ["S9"]); // seat 0
    g = playCards(g, ["S10"]); // seat 1 beats
    expect(g.best).toBe(1);
    // seat 2 is on the team of seat 0, but seat 1 (the other team) is winning: must beat with S14
    expect(legalPlays(g).map((p) => p[0].id)).toEqual(["S14"]);
    g = playCards(g, ["S14"]);
    expect(g.best).toBe(2);
    // seat 3 faces the other team's winner... seat 2 is seat 3's opponent (teams are 0+2 / 1+3): must beat the ace
    expect(legalPlays(g)).toHaveLength(3);
    g = playCards(g, ["D10"]);
    expect(g.phase).toBe("trickEnd");
    const done = finishTrick(g);
    expect(done.leader).toBe(2);
    expect(done.piles).toEqual([31, 0]);
  });

  it("a partner who is winning leaves the others free to play anything", () => {
    let g = table([
      [c("S", 14), c("D", 7), c("C", 6)],
      [c("S", 9), c("D", 8), c("C", 7)],
      [c("S", 10), c("D", 9), c("C", 8)],
      [c("S", 13), c("S", 12), c("D", 10)],
    ]);
    g = playCards(g, ["S14"]); // seat 0, unbeaten
    g = playCards(g, ["D8"]);
    // seat 2 is seat 0's partner, who is winning: free choice
    expect(legalPlays(g)).toHaveLength(3);
  });
});

describe("whole games", () => {
  function playOut(players: 2 | 4, seed: number) {
    const r = rng(seed);
    let g = createGame(players, r);
    let steps = 0;
    while (g.phase !== "gameEnd" && steps++ < 20000) {
      if (g.phase === "roundEnd") g = nextRound(g, r);
      else if (g.phase === "trickEnd") g = finishTrick(g);
      else {
        const options = legalPlays(g);
        expect(options.length).toBeGreaterThan(0);
        g = playCards(g, options[Math.floor(r() * options.length)].map((x) => x.id));
      }
      // every card is in exactly one place
      const all = [...g.hands.flat(), ...g.deck.slice(0, g.deck.length > 0 ? g.deck.length - 1 : 0), ...g.seen, ...g.trick.flatMap((p) => p.cards)];
      if (g.phase === "play" && g.result === null) {
        const ids = new Set(all.map((x) => x.id));
        const withTrumpCard = g.deck.length > 0 ? 1 : 0;
        expect(ids.size + withTrumpCard).toBe(36);
        expect(all).toHaveLength(ids.size);
      }
      if (g.result && g.result.bura === null && g.result.winner !== null) {
        expect(g.result.piles[0] + g.result.piles[1]).toBe(120);
      }
    }
    return g;
  }

  it("random games finish, with 120 points in every round", () => {
    for (let seed = 1; seed <= 40; seed++) {
      expect(playOut(2, seed).phase).toBe("gameEnd");
      expect(playOut(4, seed).phase).toBe("gameEnd");
    }
  });

  it("unseenCards excludes what the player can see", () => {
    const g = createGame(2, rng(5));
    const unseen = unseenCards(g, g.turn);
    expect(unseen).toHaveLength(36 - 3 - 1);
    expect(unseen.some((x) => g.hands[g.turn].some((h) => h.id === x.id))).toBe(false);
    expect(unseen.some((x) => x.id === g.trumpCard.id)).toBe(false);
  });
});
