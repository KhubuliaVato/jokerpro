import { describe, expect, it } from "vitest";
import type { NormalCard, Rank, Suit } from "../joker/cards";
import {
  beats,
  answerCall,
  beatsCombo,
  buildDeck,
  canCall,
  cardPoints,
  createGame,
  decideVar,
  finishTrick,
  isLegal,
  makeCall,
  molotka,
  legalPlays,
  nextRound,
  playCards,
  sumPoints,
  unseenCards,
  type BuraState,
} from "./engine";

/** The trick goes to its winner, who just carries on (no "var"). */
const carryOn = (s: BuraState): BuraState => {
  const next = finishTrick(s);
  return next.phase === "var" ? decideVar(next, false) : next;
};

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
  it("two play with the 20 cards from ten to ace, four with all 36", () => {
    expect(buildDeck(2)).toHaveLength(20);
    expect(buildDeck(2).every((x) => x.rank >= 10)).toBe(true);
    expect(sumPoints(buildDeck(2))).toBe(120);
    expect(buildDeck(4)).toHaveLength(36);
  });

  it("gives three cards each (two players) or five (four), turns up the trump and puts it under the pile", () => {
    for (const n of [2, 4] as const) {
      const g = createGame(n, rng(7));
      const size = n === 4 ? 5 : 3;
      expect(g.hands.map((h) => h.length)).toEqual(Array(n).fill(size));
      expect(g.deck).toHaveLength(buildDeck(n).length - n * size);
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

  it("nobody leads more cards than the shortest hand holds", () => {
    const g = table([[c("S", 14), c("S", 10), c("S", 7)], [c("S", 9), c("D", 8)]]);
    expect(Math.max(...legalPlays(g).map((p) => p.length))).toBe(2);
  });

  it("the answer has the same size, but any cards may be put down", () => {
    const g = playCards(table([[c("S", 10), c("D", 7), c("C", 6)], [c("S", 14), c("S", 9), c("D", 8)]]), ["S10"]);
    expect(legalPlays(g).map((p) => p[0].id).sort()).toEqual(["D8", "S14", "S9"]);
    expect(isLegal(g, ["S9"])).toBe(true);
    expect(isLegal(g, ["S9", "D8"])).toBe(false);
  });

  it("an answer that beats takes the lead and is shown; any other is thrown down face down", () => {
    const base = table([[c("S", 10), c("D", 7), c("C", 6)], [c("S", 14), c("S", 9), c("D", 8)]]);
    const beaten = playCards(playCards(base, ["S10"]), ["S14"]);
    expect(beaten.best).toBe(1);
    expect(beaten.trick.map((p) => p.hidden)).toEqual([false, false]);
    const thrown = playCards(playCards(base, ["S10"]), ["S9"]);
    expect(thrown.best).toBe(0);
    expect(thrown.trick.map((p) => p.hidden)).toEqual([false, true]);
    expect(thrown.gave[1].map((x) => x.id)).toEqual(["S9"]);
  });

  it("a trump beats a plain card", () => {
    const g = playCards(table([[c("S", 14), c("D", 7), c("C", 6)], [c("H", 7), c("S", 9), c("D", 8)]]), ["S14"]);
    expect(playCards(g, ["H7"]).best).toBe(1);
    expect(playCards(g, ["S9"]).best).toBe(0);
  });

  it("a two-card lead needs two cards that each beat a different card; one ace is not enough", () => {
    const g = playCards(table([[c("S", 10), c("S", 9), c("D", 6)], [c("S", 14), c("S", 8), c("D", 8)]]), ["S10", "S9"]);
    expect(legalPlays(g)).toHaveLength(3);
    expect(playCards(g, ["S14", "S8"]).best).toBe(0);
    const h = playCards(table([[c("S", 10), c("S", 9), c("D", 6)], [c("S", 14), c("S", 13), c("D", 8)]]), ["S10", "S9"]);
    expect(playCards(h, ["S13", "S14"]).best).toBe(1);
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
    g = carryOn(g);
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
    g = carryOn(g);
    expect(g.leader).toBe(0);
    expect(g.piles).toEqual([11, 0]);
  });
});

describe("round end", () => {
  /** One trick left in each hand, played so that seat 0 takes it. */
  const last = (piles: number[], tricks: number[]) => {
    const g = table([[c("S", 14)], [c("S", 9)]], { piles, tricks });
    return carryOn(playCards(playCards(g, ["S14"]), ["S9"]));
  };

  it("61 wins the round, worth one game point whatever the loser took", () => {
    expect(last([50, 59], [3, 3]).result).toMatchObject({ winner: 0, gain: 1 });
    expect(last([50, 40], [3, 3]).result?.piles).toEqual([61, 40]);
    expect(last([50, 40], [3, 3]).scores).toEqual([1, 0]);
    expect(last([50, 20], [3, 3]).result).toMatchObject({ winner: 0, gain: 1 });
    expect(last([50, 0], [3, 0]).result).toMatchObject({ winner: 0, gain: 1 });
  });

  it("a round is worth its price", () => {
    const g = table([[c("S", 14)], [c("S", 9)]], { piles: [50, 40], tricks: [3, 3], price: 3 });
    expect(carryOn(playCards(playCards(g, ["S14"]), ["S9"])).scores).toEqual([3, 0]);
  });

  it("60:60 scores nothing and the match goes on", () => {
    const g = last([49, 60], [3, 3]);
    expect(g.result).toMatchObject({ winner: null, gain: 0 });
    expect(g.scores).toEqual([0, 0]);
    expect(g.phase).toBe("roundEnd");
  });

  it("the match ends at the target", () => {
    const g = table([[c("S", 14)], [c("S", 9)]], { piles: [50, 40], tricks: [3, 3], scores: [11, 5] });
    expect(carryOn(playCards(playCards(g, ["S14"]), ["S9"])).phase).toBe("gameEnd");
  });

  it("the next round is dealt after the dealer changes", () => {
    const g = last([50, 40], [3, 3]);
    const n = nextRound(g, rng(3));
    expect(n.round).toBe(1);
    expect(n.dealer).toBe((g.dealer + 1) % 2);
    expect(n.hands.map((h) => h.length)).toEqual([3, 3]);
    expect(n.price).toBe(1);
    expect(n.scores).toEqual(g.scores);
  });
});

describe("bura", () => {
  it("three trumps in a hand after drawing end the round and are worth the round's price", () => {
    const g = table([[c("S", 10), c("D", 7), c("C", 6)], [c("S", 14), c("H", 9), c("H", 7)]], {
      deck: [c("H", 12), c("D", 6), c("C", 8), c("S", 8)],
    });
    // seat 1 wins the trick, draws first and so completes three trumps
    const done = carryOn(playCards(playCards(g, ["S10"]), ["S14"]));
    expect(done.result).toMatchObject({ winner: 1, gain: 1, bura: 1 });
    expect(done.scores).toEqual([0, 1]);
  });

  it("a dealt hand of three trumps wins at once", () => {
    for (let seed = 1; seed < 4000; seed++) {
      const g = createGame(2, rng(seed));
      if (g.result?.bura !== null && g.result) {
        expect(g.result.gain).toBe(1);
        expect(g.scores[g.result.winner!]).toBe(1);
        expect(g.phase).toBe("roundEnd");
        return;
      }
    }
    throw new Error("no bura found in 4000 deals");
  });
});

describe("four players", () => {
  it("answer in turn; the best answer takes the lead", () => {
    let g = table([
      [c("S", 9), c("D", 7), c("C", 6)],
      [c("S", 10), c("D", 8), c("C", 7)],
      [c("S", 14), c("D", 9), c("C", 8)],
      [c("S", 13), c("S", 12), c("D", 10)],
    ]);
    g = playCards(g, ["S9"]); // seat 0
    g = playCards(g, ["S10"]); // seat 1 beats
    expect(g.best).toBe(1);
    g = playCards(g, ["S14"]); // seat 2 beats again
    expect(g.best).toBe(2);
    g = playCards(g, ["D10"]); // seat 3 cannot beat the ace: thrown down
    expect(g.trick[3].hidden).toBe(true);
    expect(g.phase).toBe("trickEnd");
    const done = finishTrick(g);
    expect(done.leader).toBe(2);
    // all four cards (the secret ten included) are in the pile of the winner's team
    expect(done.piles).toEqual([31, 0]);
    // the winning team has not seen the ten of diamonds: it is one unknown card in its pile
    expect(done.known).toEqual([21, 0]);
    expect(done.unknown).toEqual([1, 0]);
  });

  it("a partner who is winning may be fed points: those cards stay secret from the others", () => {
    let g = table([
      [c("S", 14), c("D", 7), c("C", 6)],
      [c("S", 9), c("D", 8), c("C", 7)],
      [c("S", 10), c("D", 9), c("C", 8)],
      [c("S", 13), c("S", 12), c("D", 10)],
    ]);
    g = playCards(g, ["S14"]);
    g = playCards(g, ["D8"]);
    g = playCards(g, ["S10"]);
    expect(g.trick[2].hidden).toBe(true);
    expect(g.best).toBe(0);
  });

  it("five cards each, and every trick refills the hands at once (no var with four players)", () => {
    let s = createGame(4, rng(3));
    while (s.phase === "play" && s.trick.length < 4) s = playCards(s, legalPlays(s)[0].map((x) => x.id));
    expect(s.phase).toBe("trickEnd");
    const next = finishTrick(s);
    expect(next.phase).toBe("play");
    expect(next.hands.every((h) => h.length === 5)).toBe(true);
  });
});

describe("whole games", () => {
  function playOut(players: 2 | 4, seed: number) {
    const r = rng(seed);
    let g = createGame(players, r);
    let steps = 0;
    while (g.phase !== "gameEnd" && steps++ < 20000) {
      if (g.phase === "roundEnd") g = nextRound(g, r);
      else if (g.phase === "trickEnd") g = carryOn(g);
      else {
        const options = legalPlays(g);
        expect(options.length).toBeGreaterThan(0);
        g = playCards(g, options[Math.floor(r() * options.length)].map((x) => x.id));
      }
      // the 120 points are always somewhere: in a hand, the pile, the trick or somebody's pile of won cards
      if (g.result === null) {
        const inPlay = sumPoints([...g.hands.flat(), ...g.deck, ...g.trick.flatMap((p) => p.cards)]);
        expect(inPlay + g.piles[0] + g.piles[1]).toBe(120);
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
 }, 30000);

  it("unseenCards excludes what the player can see", () => {
    const g = createGame(2, rng(5));
    const unseen = unseenCards(g, g.turn);
    expect(unseen).toHaveLength(20 - 3 - 1);
    expect(unseen.some((x) => g.hands[g.turn].some((h) => h.id === x.id))).toBe(false);
    expect(unseen.some((x) => x.id === g.trumpCard.id)).toBe(false);
  });
});

describe("molotka", () => {
  const hearts = [c("H", 6), c("H", 7), c("H", 8)];
  const mtable = (hands: NormalCard[][], over: Partial<BuraState> = {}) => table(hands, { deck: buildDeck(4).slice(0, 30), ...over });

  it("three-card game: a whole hand of one suit may be put down over a shorter lead", () => {
    const g = playCards(mtable([[c("D", 14), c("D", 7), c("C", 6)], [...hearts]]), ["D14"]);
    expect(molotka(g)).toHaveLength(3);
    expect(isLegal(g, ["H6", "H7", "H8"])).toBe(true);
    expect(isLegal(g, ["H6"])).toBe(true); // the ordinary answers are still there
    // it needs no beating of the lead card: a weak suit goes down just as well
    const weak = playCards(mtable([[c("H", 14), c("D", 7), c("C", 6)], [c("D", 8), c("D", 9), c("D", 10)]]), ["H14"]);
    expect(molotka(weak)).toHaveLength(3);
  });

  it("the leader has to add to the lead; a molotka stands unless the combined cards beat it card by card", () => {
    let g = playCards(mtable([[c("D", 14), c("D", 13), c("D", 12)], [...hearts]]), ["D14"]);
    g = playCards(g, ["H6", "H7", "H8"]);
    expect(g.mol).toBe(3);
    expect(g.phase).toBe("play");
    expect(g.turn).toBe(0);
    expect(legalPlays(g).every((p) => p.length === 2)).toBe(true);
    // the diamonds do not beat the hearts (hearts are trump): the molotka took the lead
    const done = playCards(g, ["D13", "D12"]);
    expect(done.phase).toBe("trickEnd");
    expect(done.best).toBe(1);
    expect(done.trick[2].hidden).toBe(true);
    expect(finishTrick(done).leader).toBe(1);
  });

  it("the molotka fails when the leader's cards beat it", () => {
    let g = playCards(mtable([[c("H", 14), c("H", 13), c("H", 12)], [c("D", 6), c("D", 7), c("D", 8)]]), ["H14"]);
    g = playCards(g, ["D6", "D7", "D8"]);
    const done = playCards(g, ["H13", "H12"]);
    expect(done.best).toBe(2);
    expect(done.trick[2].hidden).toBe(false);
  });

  it("is not allowed with mixed suits, or against a full-size lead", () => {
    const mixed = playCards(mtable([[c("D", 14), c("D", 7), c("C", 6)], [c("H", 6), c("H", 7), c("S", 8)]]), ["D14"]);
    expect(molotka(mixed)).toBeNull();
    const full = playCards(mtable([[c("D", 14), c("D", 13), c("D", 12)], [...hearts]]), ["D14", "D13", "D12"]);
    expect(molotka(full)).toBeNull();
  });

  it("five-card game: only over a single card of an opponent that all five cards beat", () => {
    const five = [c("H", 6), c("H", 7), c("H", 8), c("H", 9), c("H", 10)];
    const rest = [c("D", 6), c("D", 7), c("D", 8), c("D", 9), c("C", 6)];
    let g = mtable([[c("D", 14), ...rest.slice(0, 4)], [...five], [...rest], [...rest]]);
    g = playCards(g, ["D14"]);
    expect(molotka(g)).toHaveLength(5);
    // two cards led: no molotka
    let h = mtable([[c("D", 14), c("D", 13), ...rest.slice(0, 3)], [...five], [...rest], [...rest]]);
    h = playCards(h, ["D14", "D13"]);
    expect(molotka(h)).toBeNull();
    // a card of the molotka that does not beat the lead: no molotka
    let w = mtable([[c("H", 9), ...rest.slice(0, 4)], [...five], [...rest], [...rest]]);
    w = playCards(w, ["H9"]);
    expect(molotka(w)).toBeNull();
  });

  it("five-card game: everybody ends up with five cards on the table", () => {
    const five = [c("H", 6), c("H", 7), c("H", 8), c("H", 9), c("H", 10)];
    const a = [c("D", 14), c("D", 13), c("D", 12), c("D", 11), c("D", 10)];
    const b = [c("S", 6), c("S", 7), c("S", 8), c("S", 9), c("S", 10)];
    const d = [c("C", 6), c("C", 7), c("C", 8), c("C", 9), c("C", 10)];
    let g = mtable([a, five, b, d]);
    g = playCards(g, ["D14"]); // seat 0 leads one card
    g = playCards(g, five.map((x) => x.id)); // seat 1: molotka
    expect(g.mol).toBe(5);
    expect(g.turn).toBe(2);
    g = playCards(g, b.map((x) => x.id)); // seat 2 has to put down the whole hand
    g = playCards(g, d.map((x) => x.id)); // so has seat 3
    expect(g.turn).toBe(0);
    expect(legalPlays(g).every((p) => p.length === 4)).toBe(true);
    g = playCards(g, ["D13", "D12", "D11", "D10"]); // the leader adds four
    expect(g.phase).toBe("trickEnd");
    expect(g.trick[g.best].player).toBe(1); // the hearts are trump
    expect(finishTrick(g).leader).toBe(1);
  });
});

describe("var", () => {
  /** Seat 1 takes a trick worth 21 on top of the given pile, with cards still to be drawn. */
  const afterTrick = (piles: number[]) => {
    const g = table([[c("S", 10), c("D", 7), c("C", 6)], [c("S", 14), c("S", 9), c("D", 8)]], {
      deck: [c("D", 14), c("D", 13), c("C", 14), c("H", 6)],
      piles,
    });
    return finishTrick(playCards(playCards(g, ["S10"]), ["S14"]));
  };

  it("the winner of a trick decides before anybody draws", () => {
    const g = afterTrick([0, 0]);
    expect(g.phase).toBe("var");
    expect(g.turn).toBe(1);
    expect(g.hands[1]).toHaveLength(2);
    const on = decideVar(g, false);
    expect(on.phase).toBe("play");
    expect(on.hands[1]).toHaveLength(3);
    expect(on.turn).toBe(1);
  });

  it("with 31 points the round is won at once, at the price of the round", () => {
    const g = { ...afterTrick([0, 10]), price: 2 };
    expect(g.piles[1]).toBe(31);
    const done = decideVar(g, true);
    expect(done.result).toMatchObject({ winner: 1, gain: 2, how: "var", by: 1 });
    expect(done.scores).toEqual([0, 2]);
  });

  it("with fewer than 31 the others win the round", () => {
    const done = decideVar(afterTrick([0, 9]), true);
    expect(done.piles[1]).toBe(30);
    expect(done.result).toMatchObject({ winner: 0, gain: 1, how: "var", by: 1 });
    expect(done.scores).toEqual([1, 0]);
  });

  it("the last trick has nothing to decide", () => {
    const g = table([[c("S", 14)], [c("S", 9)]]);
    expect(finishTrick(playCards(playCards(g, ["S14"]), ["S9"])).phase).toBe("roundEnd");
  });
});

describe("calls", () => {
  const g0 = () => table([[c("S", 14), c("D", 7), c("C", 6)], [c("S", 9), c("D", 8), c("C", 7)]]);

  it("a player on turn calls; the other side answers; accepted, the round is worth more and the caller goes on", () => {
    expect(canCall(g0())).toBe(true);
    const asked = makeCall(g0());
    expect(asked.phase).toBe("call");
    expect(asked.call).toEqual({ by: 0, level: 2 });
    expect(asked.turn).toBe(1);
    const on = answerCall(asked, "accept");
    expect(on).toMatchObject({ phase: "play", price: 2, turn: 0, call: null, raised: 0 });
    // the caller's side cannot raise again until the other side does
    expect(canCall(on)).toBe(false);
  });

  it("giving in hands the caller the price from before the call", () => {
    const done = answerCall(makeCall(g0()), "fold");
    expect(done.result).toMatchObject({ winner: 0, gain: 1, how: "fold", by: 0 });
    expect(done.scores).toEqual([1, 0]);
  });

  it("raising makes the earlier call the price; giving in to the raise pays that price", () => {
    const raised = answerCall(makeCall(g0()), "raise");
    expect(raised.price).toBe(2);
    expect(raised.call).toEqual({ by: 1, level: 3 });
    expect(raised.turn).toBe(0);
    const done = answerCall(raised, "fold");
    expect(done.result).toMatchObject({ winner: 1, gain: 2 });
    const accepted = answerCall(raised, "accept");
    expect(accepted).toMatchObject({ price: 3, turn: 1, raised: 1 });
    expect(canCall(accepted)).toBe(false);
  });

  it("nothing goes above shashi, and the round pays the price when it is won", () => {
    let g = { ...g0(), price: 5 };
    g = answerCall(makeCall(g), "accept");
    expect(g.price).toBe(6);
    expect(() => makeCall({ ...g, raised: null })).toThrow();
    const r = { ...g0(), price: 5 };
    const asked = makeCall(r);
    expect(() => answerCall(answerCall(asked, "raise"), "raise")).toThrow();
  });

  it("a call needs your turn in the play phase", () => {
    const g = playCards(g0(), ["S14"]);
    expect(canCall(g, 0)).toBe(false);
    expect(canCall(g, 1)).toBe(true);
  });
});
