export interface GameInfo {
  /** Value stored in game_results.game. */
  id: string;
  name: string;
  icon: string;
  href: string;
}

/** Every game of the hub. Add new games here: the profile gets a stats tab for each one. */
export const GAMES: GameInfo[] = [{ id: "joker", name: "ჯოკერი", icon: "♠", href: "/joker" }];

export const gameName = (id: string): string => GAMES.find((g) => g.id === id)?.name ?? id;
