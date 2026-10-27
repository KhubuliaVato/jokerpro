import { shuffle, type NormalCard, type Rng, type Suit } from "../joker/cards";
import type { BotProfile } from "../joker/botProfiles";
import {
  beatsCombo,
  cardPoints,
  combinations,
  legalPlays,
  sumPoints,
  teamOf,
  unseenCards,
  type BuraState,
} from "./engine";

/** How a Bura bot thinks: how many imagined deals it weighs, and how often it plays a random legal move instead. */
export interface BuraStyle {
  samples: number;
  mistake: number;
}

export const STRONG_STYLE: BuraStyle = { samples: 48, mistake: 0 };

/** The same nine bots as in Joker; their level decides how carefully they play. */
export function styleFor(bot: Pick<BotProfile, "style">): BuraStyle {
  const m = bot.style.mistake;
  return { samples: m > 0.15 ? 6 : m > 0.05 ? 18 : 48, mistake: m };
}

/** What keeping a card is worth to its owner: a trump is a way of winning later. */
const keepValue = (c: NormalCard, trump: Suit) => (c.suit === trump ? 4 + 0.6 * (c.rank - 6) : 0);
const spend = (cards: NormalCard[], trump: Suit) => cards.reduce((n, c) => n + cardPoints(c.rank) + keepValue(c, trump), 0);

/** What a player does with no cleverness: the cheapest way to beat, else the cheapest throw-away. */
function simpleAnswer(hand: NormalCard[], top: NormalCard[], partnerWinning: boolean, trump: Suit): NormalCard[] {
  const all = combinations(hand, top.length);
  const beating = partnerWinning ? all : all.filter((c) => beatsCombo(c, top, trump));
  const choices = beating.length > 0 ? beating : all;
  return choices.reduce((best, c) => (spend(c, trump) < spend(best, trump) ? c : best));
}

/** Plays out the rest of the trick with the other hands guessed, and says how good it was for `me` (in points). */
function valueOf(s: BuraState, me: number, option: NormalCard[], guess: NormalCard[][]): number {
  const plays = s.trick.map((p) => ({ player: p.player, cards: p.cards }));
  plays.push({ player: me, cards: option });
  let best = plays.length === 1 || beatsCombo(option, plays[s.best].cards, s.trump) ? plays.length - 1 : s.best;
  while (plays.length < s.players) {
    const p = (plays[plays.length - 1].player + 1) % s.players;
    const top = plays[best];
    const answer = simpleAnswer(guess[p], top.cards, teamOf(top.player) === teamOf(p), s.trump);
    plays.push({ player: p, cards: answer });
    if (beatsCombo(answer, top.cards, s.trump)) best = plays.length - 1;
  }
  const points = sumPoints(plays.flatMap((p) => p.cards));
  const won = teamOf(plays[best].player) === teamOf(me);
  // Winning also brings the lead; spending trumps costs something for the rest of the round.
  const kept = option.reduce((n, c) => n + keepValue(c, s.trump), 0);
  return (won ? points + 1 : -points) - 0.6 * kept;
}

/** The cards the bot on turn plays. */
export function botMove(s: BuraState, style: BuraStyle = STRONG_STYLE, rng: Rng = Math.random): string[] {
  const options = legalPlays(s);
  if (options.length === 0) throw new Error("nothing to play");
  const pick = (o: NormalCard[]) => o.map((c) => c.id);
  if (options.length === 1) return pick(options[0]);
  if (style.mistake > 0 && rng() < style.mistake) return pick(options[Math.floor(rng() * options.length)]);

  const me = s.turn;
  const unseen = unseenCards(s, me);
  const others = Array.from({ length: s.players }, (_, p) => p).filter((p) => p !== me);
  const totals = options.map(() => 0);
  for (let i = 0; i < style.samples; i++) {
    const cards = shuffle(unseen, rng);
    const guess: NormalCard[][] = Array.from({ length: s.players }, () => []);
    let at = 0;
    for (const p of others) {
      // Hands of players who already played in this trick are smaller by what they put down.
      const size = s.hands[p].length;
      guess[p] = cards.slice(at, at + size);
      at += size;
    }
    options.forEach((o, k) => {
      totals[k] += valueOf(s, me, o, guess);
    });
  }
  let best = 0;
  for (let k = 1; k < options.length; k++) if (totals[k] > totals[best]) best = k;
  return pick(options[best]);
}
