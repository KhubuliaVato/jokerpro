/** How a bot plays: 0 everywhere is the standard (strong) bot the online server uses for empty seats. */
export interface BotStyle {
  /** Chance of bidding one trick more or less than it thinks. */
  bidNoise: number;
  /** Chance of playing a random legal card instead of the best one. */
  mistake: number;
  /** Leans its bids up (+) or down (−) by this many tricks. */
  bidBias: number;
}

export const STANDARD_STYLE: BotStyle = { bidNoise: 0, mistake: 0, bidBias: 0 };

export type BotTier = "easy" | "medium" | "hard";

export const TIER_LABEL: Record<BotTier, string> = {
  easy: "დამწყები",
  medium: "საშუალო",
  hard: "ძლიერი",
};

export interface BotProfile {
  id: string;
  name: string;
  tier: BotTier;
  /** One line about how they play. */
  trait: string;
  style: BotStyle;
  /** Avatar colour (see AVATAR_COLORS) and icon. */
  color: string;
  icon: string;
}

/** The opponents to choose from, three per level. */
export const BOTS: BotProfile[] = [
  { id: "nika", name: "ნიკა", tier: "easy", trait: "ახალი სწავლობს და ხშირად ცდება", style: { bidNoise: 0.5, mistake: 0.3, bidBias: 0 }, color: "sky", icon: "♣" },
  { id: "mzia", name: "მზია", tier: "easy", trait: "ფრთხილია და ბევრჯერ პასს ამბობს", style: { bidNoise: 0.35, mistake: 0.25, bidBias: -1 }, color: "rose", icon: "♥" },
  { id: "gio", name: "გიო", tier: "easy", trait: "სულ რისკავს და მეტს ამბობს", style: { bidNoise: 0.4, mistake: 0.3, bidBias: 1 }, color: "amber", icon: "♦" },
  { id: "levani", name: "ლევანი", tier: "medium", trait: "ჩვეულებრივი, გაწონასწორებული მოთამაშე", style: { bidNoise: 0.2, mistake: 0.1, bidBias: 0 }, color: "sky", icon: "♠" },
  { id: "nino", name: "ნინო", tier: "medium", trait: "ყურადღებიანია, იშვიათად ცდება", style: { bidNoise: 0.15, mistake: 0.08, bidBias: 0 }, color: "violet", icon: "♥" },
  { id: "mariami", name: "მარიამი", tier: "medium", trait: "ცოტა მეტს ამბობს, ვიდრე უნდა", style: { bidNoise: 0.18, mistake: 0.1, bidBias: 0.4 }, color: "emerald", icon: "♦" },
  { id: "dato", name: "დათო", tier: "hard", trait: "ტაქტიკოსია და კარტებს ითვლის", style: { bidNoise: 0.05, mistake: 0.02, bidBias: 0 }, color: "slate", icon: "♠" },
  { id: "tamar", name: "თამარ", tier: "hard", trait: "ცივი გონება: თითქმის არასდროს ცდება", style: STANDARD_STYLE, color: "violet", icon: "♛" },
  { id: "zura", name: "ზურა", tier: "hard", trait: "ჯოკერის ოსტატი, დაკვეთებში ზუსტია", style: STANDARD_STYLE, color: "amber", icon: "★" },
];

/** The three opponents played against when nothing is chosen. */
export const DEFAULT_BOTS = ["levani", "nino", "mariami"];

export const botById = (id: string): BotProfile => BOTS.find((b) => b.id === id) ?? BOTS[3];

/** Three different bots, drawn at random from the given tier (or from everybody). */
export function randomBots(tier?: BotTier, rng: () => number = Math.random): string[] {
  const pool = BOTS.filter((b) => !tier || b.tier === tier).map((b) => b.id);
  const picked: string[] = [];
  while (picked.length < 3 && pool.length > 0) {
    picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return picked;
}
