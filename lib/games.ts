import { tt } from "./lang";

export interface GameInfo {
  /** Value stored in game_results.game. */
  id: string;
  name: string;
  icon: string;
  href: string;
}

/** Every game of the hub. Add new games here: the profile gets a stats tab for each one. */
export const GAMES: GameInfo[] = [
  { id: "joker", get name() { return tt("ჯოკერი", "Joker", "Джокер"); }, icon: "♠", href: "/joker" },
  { id: "bura", get name() { return tt("ბურა", "Bura", "Бура"); }, icon: "♥", href: "/bura" },
];

export const gameName = (id: string): string => GAMES.find((g) => g.id === id)?.name ?? id;
