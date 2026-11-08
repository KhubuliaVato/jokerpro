export const RARITIES = ["standard", "epic", "legendary", "ultimate", "mythic"] as const;
export type Rarity = (typeof RARITIES)[number];

/** Which ids belong to which rarity (the prices live in the database, in shop_items). */
const RARITY_IDS: Record<Rarity, string[]> = {
  standard: ["j_classic", "crimson", "damask", "f_hex", "f_octa", "f_squircle", "f_laurel", "n_terminal", "n_chrome", "n_glitch", "n_ghost", "blue", "purple", "graphite", "dusk", "bronze", "w_snow", "w_hearts", "w_coins", "s_wood", "s_soft", "s_arcade", "r_bravo", "r_hearts", "t_rose", "t_tomato", "t_egg", "p_spark"],
  epic: ["j_ice", "emerald", "frost", "aurora", "f_star", "f_gold", "f_seal", "f_ice", "n_gold", "n_sparkle", "n_frost", "n_glacier", "suits", "snow", "waves", "glacier", "w_lightning", "w_rainbow", "w_sparks", "w_ice", "s_crystal", "s_ice", "r_fire", "r_mic", "r_flag", "r_cold", "t_snowball", "t_pie", "p_frost", "p_wave", "p_shatter"],
  legendary: ["j_sakura", "j_gilded", "gilded", "sakura", "neon", "f_neon", "f_sakura", "f_frost", "f_flame", "n_neon", "n_sakura", "n_fire", "blossom", "stars", "northern", "embers", "w_confetti", "w_gold", "w_sakura", "s_sakura", "r_fireworks", "r_petals", "t_bouquet", "p_fire", "p_sakura"],
  ultimate: ["j_carbon", "j_night", "obsidian", "midnight", "carbon", "f_carbon", "f_moon", "f_royal", "n_carbon", "n_night", "n_rainbow", "carbonbg", "lullaby", "w_carbon", "w_night", "w_fire", "s_carbon", "s_night", "r_moon", "r_crown", "p_carbon", "p_night"],
  mythic: ["j_matrix", "matrix", "f_matrix", "n_matrix", "matrixbg", "w_matrix", "s_matrix", "r_pill", "p_matrix"],
};

/** The rarity of an item by id; anything unknown counts as standard. */
export const rarityOf = (id: string): Rarity => RARITIES.find((r) => RARITY_IDS[r].includes(id)) ?? "standard";

/** Colour and name of each rarity (the frame around an item takes the colour; the CSS is `.tier-<rarity>`). */
export const RARITY_LOOK: Record<Rarity, { color: string; label: [string, string, string] }> = {
  standard: { color: "#cbd5e1", label: ["სტანდარტული", "Standard", "Стандартный"] },
  epic: { color: "#3b82f6", label: ["ეპიკური", "Epic", "Эпический"] },
  legendary: { color: "#fbbf24", label: ["ლეგენდარული", "Legendary", "Легендарный"] },
  ultimate: { color: "#ef4444", label: ["ულტიმეიტი", "Ultimate", "Ультимейт"] },
  mythic: { color: "#a21caf", label: ["მითიკური", "Mythic", "Мифический"] },
};
