import { describe, expect, it } from "vitest";
import { act, createGame, DEFAULT_CONFIG, nextHand, optionsFor } from "./engine";
import { botAct } from "./bot";
import { advance, botStep, parseAction, viewFor } from "./online";

describe("online views", () => {
  it("a player sees their own cards and blanks for the others, from seat 0", () => {
    const s = createGame({ ...DEFAULT_CONFIG, players: 4 });
    for (let seat = 0; seat < 4; seat++) {
      const v = viewFor(s, seat);
      expect(v.deck).toHaveLength(0);
      expect(v.seats[0].hole.map((c) => c.id)).toEqual(s.seats[seat].hole.map((c) => c.id));
      for (let i = 1; i < 4; i++) {
        const real = (i + seat) % 4;
        expect(v.seats[i].hole).toHaveLength(2);
        expect(v.seats[i].hole.every((c) => c.id.startsWith("hidden-"))).toBe(true);
        expect(v.seats[i].stack).toBe(s.seats[real].stack);
        expect(v.seats[i].bet).toBe(s.seats[real].bet);
      }
    }
  });

  it("rotates the button, blinds and turn consistently", () => {
    const s = createGame({ ...DEFAULT_CONFIG, players: 5 });
    for (let seat = 0; seat < 5; seat++) {
      const v = viewFor(s, seat);
      expect(v.seats[v.smallBlindSeat].bet).toBe(s.seats[s.smallBlindSeat].bet);
      expect(v.seats[v.bigBlindSeat].bet).toBe(s.seats[s.bigBlindSeat].bet);
      expect(v.turn).toBe((s.turn - seat + 5) % 5);
      expect(v.dealer).toBe((s.dealer - seat + 5) % 5);
    }
  });

  it("turns the cards of the players at the showdown face up, for everybody", () => {
    let s = createGame({ ...DEFAULT_CONFIG, players: 3 });
    for (let guard = 0; guard < 60 && s.phase === "betting"; guard++) s = act(s, optionsFor(s).canCheck ? { type: "check" } : { type: "call" });
    expect(s.result?.showdown).toBe(true);
    const v = viewFor(s, 1);
    expect(v.result!.payouts.map((p) => p.seat).sort()).toEqual(s.result!.payouts.map((p) => (p.seat - 1 + 3) % 3).sort());
    for (const real of s.result!.revealed) {
      const i = (real - 1 + 3) % 3;
      expect(v.seats[i].hole.map((c) => c.id)).toEqual(s.seats[real].hole.map((c) => c.id));
    }
  });

  it("does not show cards that were folded away without a showdown", () => {
    let s = createGame({ ...DEFAULT_CONFIG, players: 3 });
    s = act(s, { type: "raise", to: 60 });
    s = act(s, { type: "fold" });
    s = act(s, { type: "fold" });
    expect(s.result?.showdown).toBe(false);
    const v = viewFor(s, 0);
    expect(v.seats.slice(1).every((p) => p.hole.every((c) => c.id.startsWith("hidden-")))).toBe(true);
  });
});

describe("running an online hand", () => {
  it("bots playing every seat finish the hand and the next one starts", () => {
    let s = createGame({ ...DEFAULT_CONFIG, players: 4 });
    const chips = 4 * DEFAULT_CONFIG.startStack;
    for (let guard = 0; guard < 400 && s.phase === "betting"; guard++) s = botStep(s);
    expect(s.phase).toBe("handEnd");
    expect(s.seats.reduce((n, p) => n + p.stack, 0)).toBe(chips);
    s = advance(s);
    expect(s.phase === "betting" || s.phase === "gameEnd").toBe(true);
    expect(s.handNo).toBe(2);
  });

  it("the game does not stop when the first seat goes broke, only when one player has everything", () => {
    let s = createGame({ ...DEFAULT_CONFIG, players: 3, startStack: 100 }, () => 0.3);
    s.seats[0].stack = 0;
    s.seats[0].invested = 0;
    s.phase = "handEnd";
    s = nextHand(s, Math.random, false);
    expect(s.phase).toBe("betting");
    expect(s.seats[0].out).toBe(true);
  });

  it("checks what a client sends", () => {
    expect(parseAction({ type: "raise", to: 120 })).toEqual({ type: "raise", to: 120 });
    expect(parseAction({ type: "fold" })).toEqual({ type: "fold" });
    expect(() => parseAction({ type: "raise", to: "lots" })).toThrow();
    expect(() => parseAction({ type: "steal" })).toThrow();
    expect(() => parseAction(null)).toThrow();
  });

  it("players who only ever see their own view can play whole games to the end, chips conserved", () => {
    for (let seed = 1; seed <= 3; seed++) {
      let s = createGame({ ...DEFAULT_CONFIG, players: 3 + (seed % 3), startStack: 200 });
      const chips = s.seats.length * 200;
      let steps = 0;
      while (s.phase !== "gameEnd" && steps++ < 4000) {
        if (s.phase === "handEnd") {
          expect(s.seats.reduce((n, p) => n + p.stack, 0)).toBe(chips);
          s = advance(s);
          continue;
        }
        // the player on turn decides from their own view only, the server applies it to the real state
        const seat = s.turn;
        const mine = viewFor(s, seat);
        expect(mine.turn).toBe(0);
        const action = botAct(mine, { tight: 0.5, aggression: 0.5, bluff: 0.1, loose: 0.2, sims: 20 });
        s = act(s, action);
      }
      expect(s.phase).toBe("gameEnd");
      expect(s.seats.reduce((n, p) => n + p.stack, 0)).toBe(chips);
      expect(s.winner).not.toBeNull();
    }
  });
});
