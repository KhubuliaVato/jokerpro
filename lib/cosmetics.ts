import type { SupabaseClient } from "@supabase/supabase-js";
import { tt } from "./lang";

type Names = [string, string, string];
const name = (n: Names) => tt(n[0], n[1], n[2]);

/** What a player wears: every one of them is seen by the others at the table. */
export interface Worn {
  back: string | null;
  frame: string | null;
  name: string | null;
  fx: string | null;
  play: string | null;
  snd: string | null;
  /** The joker card's own look (a shop item). */
  joker: string | null;
}

export const NOTHING_WORN: Worn = { back: null, frame: null, name: null, fx: null, play: null, snd: null, joker: null };

/** Avatar frames; the look is in globals.css under `.avf-<id>`. */
export const FRAMES = [
  { id: "f_laurel", names: ["დაფნის გვირგვინი", "Laurel", "Лавр"] as Names, accent: "#4ade80" },
  { id: "f_gold", names: ["ოქრო", "Gold", "Золото"] as Names, accent: "#fbbf24" },
  { id: "f_neon", names: ["ნეონი", "Neon", "Неон"] as Names, accent: "#22d3ee" },
  { id: "f_frost", names: ["ყინული", "Frost", "Иней"] as Names, accent: "#7dd3fc" },
  { id: "f_flame", names: ["ალი", "Flame", "Пламя"] as Names, accent: "#fb923c" },
  { id: "f_royal", names: ["სამეფო", "Royal", "Королевская"] as Names, accent: "#a78bfa" },
  { id: "f_hex", names: ["ექვსკუთხედი", "Hexagon", "Шестиугольник"] as Names, accent: "#22d3ee" },
  { id: "f_octa", names: ["რვაკუთხედი", "Octagon", "Восьмиугольник"] as Names, accent: "#d6a46a" },
  { id: "f_squircle", names: ["მრგვალი კვადრატი", "Squircle", "Скруглённый квадрат"] as Names, accent: "#84cc16" },
  { id: "f_star", names: ["ვარსკვლავი", "Starburst", "Звезда"] as Names, accent: "#fbbf24" },
  { id: "f_sakura", names: ["საკურას ყვავილი", "Blossom", "Цветок сакуры"] as Names, accent: "#f9a8d4" },
  { id: "f_carbon", names: ["კარბონის მექანიზმი", "Carbon cog", "Карбоновая шестерня"] as Names, accent: "#ef4444" },
  { id: "f_ice", names: ["ფიფქი", "Snowflake", "Снежинка"] as Names, accent: "#7dd3fc" },
  { id: "f_moon", names: ["ღამის ღრუბელი", "Night cloud", "Ночное облако"] as Names, accent: "#818cf8" },
  { id: "f_matrix", names: ["მწვანე ეკრანი", "Green screen", "Зелёный экран"] as Names, accent: "#00ff41" },
  { id: "f_seal", names: ["ბეჭედი", "Seal", "Печать"] as Names, accent: "#ef4444" },
] as const;

/** Styles of a nickname; the look is in globals.css under `.nick-<id>`. */
export const NAME_STYLES = [
  { id: "n_gold", names: ["ოქროს სახელი", "Golden name", "Золотое имя"] as Names, accent: "#fbbf24" },
  { id: "n_neon", names: ["ნეონის სახელი", "Neon name", "Неоновое имя"] as Names, accent: "#22d3ee" },
  { id: "n_frost", names: ["ყინულის სახელი", "Frost name", "Ледяное имя"] as Names, accent: "#7dd3fc" },
  { id: "n_fire", names: ["ცეცხლოვანი სახელი", "Fiery name", "Огненное имя"] as Names, accent: "#fb923c" },
  { id: "n_rainbow", names: ["ცისარტყელა", "Rainbow", "Радуга"] as Names, accent: "#f472b6" },
  { id: "n_glitch", names: ["გლიჩი", "Glitch", "Глитч"] as Names, accent: "#f0abfc" },
  { id: "n_chrome", names: ["ქრომი", "Chrome", "Хром"] as Names, accent: "#cbd5e1" },
  { id: "n_terminal", names: ["ტერმინალი", "Terminal", "Терминал"] as Names, accent: "#4ade80" },
  { id: "n_ghost", names: ["აჩრდილი", "Ghost", "Призрак"] as Names, accent: "#a5b4fc" },
  { id: "n_sakura", names: ["საკურა", "Sakura", "Сакура"] as Names, accent: "#f9a8d4" },
  { id: "n_carbon", names: ["კარბონი", "Carbon", "Карбон"] as Names, accent: "#9ca3af" },
  { id: "n_glacier", names: ["მყინვარი", "Glacier", "Ледник"] as Names, accent: "#bae6fd" },
  { id: "n_night", names: ["ღამე", "Night", "Ночь"] as Names, accent: "#a5b4fc" },
  { id: "n_matrix", names: ["კოდი", "Code", "Код"] as Names, accent: "#00ff41" },
  { id: "n_sparkle", names: ["ბრჭყვიალა", "Sparkle", "Сияние"] as Names, accent: "#c084fc" },
] as const;

/** What the cards of a won trick do; the look is in globals.css under `.fxw-<id>`. */
export const WIN_FX = [
  { id: "w_sparks", names: ["ნაპერწკლები", "Sparks", "Искры"] as Names, accent: "#fde68a" },
  { id: "w_gold", names: ["ოქროს ბრწყინვა", "Golden shine", "Золотой блеск"] as Names, accent: "#fbbf24" },
  { id: "w_confetti", names: ["ფეიერვერკი", "Fireworks", "Салют"] as Names, accent: "#f472b6" },
  { id: "w_fire", names: ["ცეცხლი", "Fire", "Огонь"] as Names, accent: "#f97316" },
  { id: "w_snow", names: ["თოვლი", "Snowfall", "Снегопад"] as Names, accent: "#7dd3fc" },
  { id: "w_hearts", names: ["გულები", "Hearts", "Сердца"] as Names, accent: "#fb7185" },
  { id: "w_coins", names: ["ოქროს წვიმა", "Gold shower", "Золотой дождь"] as Names, accent: "#f59e0b" },
  { id: "w_lightning", names: ["ელვა", "Lightning", "Молния"] as Names, accent: "#38bdf8" },
  { id: "w_sakura", names: ["ყვავილის ფურცლები", "Petals", "Лепестки"] as Names, accent: "#f9a8d4" },
  { id: "w_carbon", names: ["წითელი ნაპერწკლები", "Red sparks", "Красные искры"] as Names, accent: "#ef4444" },
  { id: "w_ice", names: ["გაყინვა", "Frozen", "Заморозка"] as Names, accent: "#7dd3fc" },
  { id: "w_night", names: ["ძილი", "Dreaming", "Сон"] as Names, accent: "#818cf8" },
  { id: "w_matrix", names: ["კოდის წვიმა", "Code rain", "Код-дождь"] as Names, accent: "#00ff41" },
  { id: "w_rainbow", names: ["ცისარტყელას რგოლი", "Rainbow ring", "Радужное кольцо"] as Names, accent: "#a78bfa" },
] as const;

/** Free emoji of the table chat; they are sent as ordinary text. */
export const CHAT_EMOJI = ["👍", "👏", "😄", "😂", "🤔", "😮", "😎", "🔥", "🎉", "🤝", "💪", "🏆", "😅", "🤦", "😤", "🙈", "😭", "🥲", "❤️", "👀"];

/** Big animated stickers everybody at the table sees; `motion` picks how the particles move (globals.css `.rx-*`). */
export const REACTIONS = [
  { id: "r_bravo", names: ["ბრავო", "Bravo", "Браво"] as Names, accent: "#fbbf24", main: "👏", bits: ["👏", "✨"], motion: "rain" },
  { id: "r_hearts", names: ["გულები", "Hearts", "Сердца"] as Names, accent: "#f472b6", main: "💖", bits: ["💖", "💗", "💕"], motion: "rise" },
  { id: "r_fire", names: ["ცეცხლი", "On fire", "Огонь"] as Names, accent: "#f97316", main: "🔥", bits: ["🔥", "🔥", "✨"], motion: "rise" },
  { id: "r_mic", names: ["მიკროფონი", "Mic drop", "Микрофон"] as Names, accent: "#a78bfa", main: "🎤", bits: ["💥", "✨"], motion: "drop" },
  { id: "r_fireworks", names: ["ფეიერვერკი", "Fireworks", "Фейерверк"] as Names, accent: "#22d3ee", main: "🎆", bits: ["✨", "🎇", "⭐"], motion: "burst" },
  { id: "r_petals", names: ["ყვავილთა წვიმა", "Blossom rain", "Дождь лепестков"] as Names, accent: "#f9a8d4", main: "🌸", bits: ["🌸", "❀", "🌸"], motion: "rain" },
  { id: "r_flag", names: ["ფინიში", "Finish", "Финиш"] as Names, accent: "#ef4444", main: "🏁", bits: ["🏁", "✨", "🏁"], motion: "rain" },
  { id: "r_cold", names: ["ცივი ქარი", "Cold snap", "Ледяной ветер"] as Names, accent: "#7dd3fc", main: "🧊", bits: ["❄️", "🧊", "✨"], motion: "rain" },
  { id: "r_moon", names: ["ღამე მშვიდობისა", "Goodnight", "Спокойной ночи"] as Names, accent: "#818cf8", main: "🌙", bits: ["⭐", "✨", "🌙"], motion: "rise" },
  { id: "r_pill", names: ["წითელი აბი", "Red pill", "Красная таблетка"] as Names, accent: "#ef4444", main: "💊", bits: ["💊", "✨", "💊"], motion: "rain" },
  { id: "r_crown", names: ["გვირგვინი", "Crown", "Корона"] as Names, accent: "#fde047", main: "👑", bits: ["✨", "⭐", "💎"], motion: "drop" },
] as const;

/** Things thrown at another player's seat. */
export const THROWABLES = [
  { id: "t_rose", names: ["ვარდი", "Rose", "Роза"] as Names, accent: "#fb7185", main: "🌹", splat: "💗" },
  { id: "t_tomato", names: ["პომიდორი", "Tomato", "Помидор"] as Names, accent: "#ef4444", main: "🍅", splat: "#dc2626" },
  { id: "t_egg", names: ["კვერცხი", "Egg", "Яйцо"] as Names, accent: "#fde68a", main: "🥚", splat: "#facc15" },
  { id: "t_snowball", names: ["თოვლის გუნდა", "Snowball", "Снежок"] as Names, accent: "#bae6fd", main: "⚪", splat: "❄️" },
  { id: "t_pie", names: ["ტორტი", "Cream pie", "Торт в лицо"] as Names, accent: "#fbcfe8", main: "🥧", splat: "#fff1f2" },
  { id: "t_bouquet", names: ["თაიგული", "Bouquet", "Букет"] as Names, accent: "#f9a8d4", main: "💐", splat: "🌸" },
] as const;

/** The effect of a card of yours landing on the table; the look is in globals.css under `.fxp-<id>`. */
export const PLAY_FX = [
  { id: "p_spark", names: ["ნაპერწკალი", "Spark", "Искра"] as Names, accent: "#fde68a" },
  { id: "p_frost", names: ["ყინვა", "Frost", "Мороз"] as Names, accent: "#7dd3fc" },
  { id: "p_wave", names: ["დარტყმის ტალღა", "Shockwave", "Ударная волна"] as Names, accent: "#a78bfa" },
  { id: "p_sakura", names: ["ფურცლების ტალღა", "Petal burst", "Всплеск лепестков"] as Names, accent: "#f9a8d4" },
  { id: "p_carbon", names: ["სიჩქარის ხაზები", "Speed lines", "Линии скорости"] as Names, accent: "#ef4444" },
  { id: "p_shatter", names: ["ყინულის ნამსხვრევები", "Ice shards", "Осколки льда"] as Names, accent: "#7dd3fc" },
  { id: "p_night", names: ["მთვარის მტვერი", "Moon dust", "Лунная пыль"] as Names, accent: "#a5b4fc" },
  { id: "p_matrix", names: ["გლიჩი სვლა", "Glitch play", "Глитч-ход"] as Names, accent: "#00ff41" },
  { id: "p_fire", names: ["ცეცხლოვანი სვლა", "Blazing play", "Огненный ход"] as Names, accent: "#f97316" },
] as const;

/** Looks of the joker card; the pictures are /skins/<id>.svg and the CSS is `.pc.joker[data-jskin]` in globals.css. */
/** The joker skins that are on sale and shown; the others are kept in the database but not drawn. */
export const JOKER_SKINS_ON = ["j_sakura", "j_matrix", "j_ice", "j_carbon", "j_night"];

/** The card back of the pack a joker skin belongs to: shown on its other side in 3D. */
export const JOKER_BACKS: Record<string, string> = { j_sakura: "sakura", j_matrix: "matrix", j_ice: "frost", j_carbon: "carbon", j_night: "midnight" };

export const JOKER_SKINS = [
  { id: "j_ice", names: ["ყინულის ჯოკერი", "Frost jester", "Ледяной шут"] as Names, accent: "#38bdf8" },
  { id: "j_sakura", names: ["საკურას ჯოკერი", "Sakura jester", "Шут сакуры"] as Names, accent: "#ec4899" },
  { id: "j_carbon", names: ["კარბონის ჯოკერი", "Carbon jester", "Карбоновый шут"] as Names, accent: "#ef4444" },
  { id: "j_night", names: ["მძინარე ჯოკერი", "Sleepy jester", "Сонный шут"] as Names, accent: "#818cf8" },
  { id: "j_matrix", names: ["კოდის ჯოკერი", "Code jester", "Шут-код"] as Names, accent: "#00ff41" },
] as const;

/** Sounds of the cards (made with Web Audio in lib/sound.ts). */
export const SOUND_PACKS = [
  { id: "s_wood", names: ["ხის დაკაკუნება", "Wood knock", "Деревянный стук"] as Names, accent: "#d6a46a" },
  { id: "s_soft", names: ["რბილი", "Soft", "Мягкий"] as Names, accent: "#94a3b8" },
  { id: "s_arcade", names: ["არკადა", "Arcade", "Аркада"] as Names, accent: "#4ade80" },
  { id: "s_sakura", names: ["კოტო", "Koto", "Кото"] as Names, accent: "#f9a8d4" },
  { id: "s_carbon", names: ["მექანიკური", "Mechanical", "Механический"] as Names, accent: "#9ca3af" },
  { id: "s_ice", names: ["ყინულის წკრიალი", "Ice chime", "Ледяной звон"] as Names, accent: "#bae6fd" },
  { id: "s_night", names: ["მუსიკალური ყუთი", "Music box", "Музыкальная шкатулка"] as Names, accent: "#c7d2fe" },
  { id: "s_matrix", names: ["მონაცემთა ჩხრიალი", "Data chirp", "Цифровой писк"] as Names, accent: "#4ade80" },
  { id: "s_crystal", names: ["კრისტალი", "Crystal", "Кристалл"] as Names, accent: "#67e8f9" },
] as const;

/** "::r:r_fire" is a reaction; "::t:t_rose.2" throws a rose at seat 2 (seats are numbered as the sender's table shows them). */
export type FxMessage = { kind: "r"; id: string } | { kind: "t"; id: string; seat: number };

export function parseFx(body: string): FxMessage | null {
  const r = /^::r:([a-z_]+)$/.exec(body);
  if (r) return REACTIONS.some((x) => x.id === r[1]) ? { kind: "r", id: r[1] } : null;
  const t = /^::t:([a-z_]+)\.([0-3])$/.exec(body);
  return t && THROWABLES.some((x) => x.id === t[1]) ? { kind: "t", id: t[1], seat: Number(t[2]) } : null;
}

/** Looks, names and accents of every cosmetic item by its id. */
export function cosmetic(id: string | null | undefined): { id: string; name: string; accent: string } | undefined {
  const all = [...FRAMES, ...NAME_STYLES, ...WIN_FX, ...REACTIONS, ...THROWABLES, ...PLAY_FX, ...SOUND_PACKS, ...JOKER_SKINS];
  const c = all.find((x) => x.id === id);
  if (c) return { id: c.id, name: name(c.names), accent: c.accent };
  return undefined;
}

const COLUMNS = { back: "equipped_back", frame: "equipped_frame", name: "equipped_name", fx: "equipped_fx", play: "equipped_play", snd: "equipped_sound", joker: "equipped_joker" } as const;
export type Slot = keyof typeof COLUMNS;

/** What a player wears; nothing (rather than an error) for a database that has not got the newer columns. */
export async function loadWorn(supabase: SupabaseClient, userId: string): Promise<Worn> {
  const all = await supabase.from("profiles").select("equipped_back, equipped_frame, equipped_name, equipped_fx, equipped_play, equipped_sound, equipped_joker").eq("id", userId).maybeSingle();
  if (!all.error && all.data) {
    const d = all.data as Record<string, string | null>;
    return { back: d.equipped_back, frame: d.equipped_frame, name: d.equipped_name, fx: d.equipped_fx, play: d.equipped_play, snd: d.equipped_sound, joker: d.equipped_joker ?? null };
  }
  const only = await supabase.from("profiles").select("equipped_back").eq("id", userId).maybeSingle();
  return { ...NOTHING_WORN, back: (only.data?.equipped_back as string | null | undefined) ?? null };
}

/** Puts an owned item on (null takes it off). */
export async function wear(supabase: SupabaseClient, userId: string, slot: Slot, itemId: string | null): Promise<string | null> {
  const { error } = await supabase.from("profiles").update({ [COLUMNS[slot]]: itemId }).eq("id", userId);
  return error ? error.message : null;
}

/** The slot an item kind is worn in; null for kinds that are not worn (themes, reactions, throwables). */
export function slotOf(kind: string): Slot | null {
  return kind === "card_back" ? "back" : kind === "frame" ? "frame" : kind === "name_style" ? "name" : kind === "win_fx" ? "fx" : kind === "play_fx" ? "play" : kind === "sound_pack" ? "snd" : kind === "joker_skin" ? "joker" : null;
}

/** Buys a new nickname (400 coins); returns an error message or null. */
export async function buyNickname(supabase: SupabaseClient, nickname: string): Promise<string | null> {
  const { error } = await supabase.rpc("change_nickname", { p_name: nickname });
  if (!error) return null;
  const m = error.message;
  if (m.includes("not enough coins")) return tt("მონეტები არ გყოფნით", "Not enough coins", "Не хватает монет");
  if (m.includes("nickname taken")) return tt("ეს სახელი დაკავებულია", "This name is taken", "Это имя занято");
  if (m.includes("bad nickname")) return tt("სახელი 2-დან 16 სიმბოლომდე უნდა იყოს", "The name must be 2 to 16 characters", "Имя должно быть от 2 до 16 символов");
  return m;
}

export const NICKNAME_PRICE = 400;
