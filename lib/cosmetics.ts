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
}

export const NOTHING_WORN: Worn = { back: null, frame: null, name: null, fx: null };

/** Avatar frames; the look is in globals.css under `.avf-<id>`. */
export const FRAMES = [
  { id: "f_laurel", names: ["დაფნის გვირგვინი", "Laurel", "Лавр"] as Names, accent: "#4ade80" },
  { id: "f_gold", names: ["ოქრო", "Gold", "Золото"] as Names, accent: "#fbbf24" },
  { id: "f_neon", names: ["ნეონი", "Neon", "Неон"] as Names, accent: "#22d3ee" },
  { id: "f_frost", names: ["ყინული", "Frost", "Иней"] as Names, accent: "#7dd3fc" },
  { id: "f_flame", names: ["ალი", "Flame", "Пламя"] as Names, accent: "#fb923c" },
  { id: "f_royal", names: ["სამეფო", "Royal", "Королевская"] as Names, accent: "#a78bfa" },
] as const;

/** Styles of a nickname; the look is in globals.css under `.nick-<id>`. */
export const NAME_STYLES = [
  { id: "n_gold", names: ["ოქროს სახელი", "Golden name", "Золотое имя"] as Names, accent: "#fbbf24" },
  { id: "n_neon", names: ["ნეონის სახელი", "Neon name", "Неоновое имя"] as Names, accent: "#22d3ee" },
  { id: "n_frost", names: ["ყინულის სახელი", "Frost name", "Ледяное имя"] as Names, accent: "#7dd3fc" },
  { id: "n_fire", names: ["ცეცხლოვანი სახელი", "Fiery name", "Огненное имя"] as Names, accent: "#fb923c" },
  { id: "n_rainbow", names: ["ცისარტყელა", "Rainbow", "Радуга"] as Names, accent: "#f472b6" },
] as const;

/** What the cards of a won trick do; the look is in globals.css under `.fxw-<id>`. */
export const WIN_FX = [
  { id: "w_sparks", names: ["ნაპერწკლები", "Sparks", "Искры"] as Names, accent: "#fde68a" },
  { id: "w_gold", names: ["ოქროს ბრწყინვა", "Golden shine", "Золотой блеск"] as Names, accent: "#fbbf24" },
  { id: "w_confetti", names: ["კონფეტი", "Confetti", "Конфетти"] as Names, accent: "#f472b6" },
  { id: "w_fire", names: ["ცეცხლი", "Fire", "Огонь"] as Names, accent: "#f97316" },
] as const;

export interface EmotePack {
  /** The shop item is `e_<id>`; the basic pack is free and has no item. */
  id: string;
  names: Names;
  emotes: string[];
  phrases: Names[];
}

export const EMOTE_PACKS: EmotePack[] = [
  {
    id: "basic",
    names: ["ძირითადი", "Basic", "Базовый"],
    emotes: ["👍", "👏", "😄", "🤔", "😮"],
    phrases: [
      ["წარმატებებს!", "Good luck!", "Удачи!"],
      ["კარგი სვლა!", "Nice move!", "Хороший ход!"],
      ["გმადლობთ!", "Thanks!", "Спасибо!"],
    ],
  },
  {
    id: "cheer",
    names: ["სიხარული", "Cheer", "Радость"],
    emotes: ["🔥", "😎", "🎉", "🤝", "💪", "🏆"],
    phrases: [],
  },
  {
    id: "tilt",
    names: ["ემოციები", "Tilt", "Эмоции"],
    emotes: ["😅", "🤦", "😤", "🙈", "😭", "🥲"],
    phrases: [],
  },
  {
    id: "talk",
    names: ["ფრაზები", "Phrases", "Фразы"],
    emotes: [],
    phrases: [
      ["ვინ გამაჩერებს ახლა?", "Who can stop me now?", "Кто меня теперь остановит?"],
      ["ეს რა იყო?!", "What was that?!", "Что это было?!"],
      ["კარგად ითამაშე!", "Well played!", "Отлично сыграно!"],
      ["ჯერ არ დამთავრებულა", "It is not over yet", "Ещё не конец"],
      ["სუფთა ბედია!", "Pure luck!", "Чистое везение!"],
      ["წუთით, ვფიქრობ…", "One moment, thinking…", "Минутку, думаю…"],
    ],
  },
];

export interface ParsedEmote {
  kind: "e" | "p";
  pack: string;
  index: number;
}

/** "::e:cheer.2" is the third emote of the cheer pack; "::p:talk.0" is its first phrase. */
export function parseEmote(body: string): ParsedEmote | null {
  const m = /^::([ep]):([a-z_]+)\.(\d{1,2})$/.exec(body);
  return m ? { kind: m[1] as "e" | "p", pack: m[2], index: Number(m[3]) } : null;
}

export const emoteBody = (kind: "e" | "p", pack: string, index: number) => `::${kind}:${pack}.${index}`;

/** The text of a parsed emote in the viewer's language; null for one that is not in the catalogue. */
export function emoteText(p: ParsedEmote): string | null {
  const pack = EMOTE_PACKS.find((x) => x.id === p.pack);
  if (!pack) return null;
  if (p.kind === "e") return pack.emotes[p.index] ?? null;
  const phrase = pack.phrases[p.index];
  return phrase ? name(phrase) : null;
}

/** Looks, names and accents of every cosmetic item by its id. */
export function cosmetic(id: string | null | undefined): { id: string; name: string; accent: string } | undefined {
  const all = [...FRAMES, ...NAME_STYLES, ...WIN_FX];
  const c = all.find((x) => x.id === id);
  if (c) return { id: c.id, name: name(c.names), accent: c.accent };
  const pack = EMOTE_PACKS.find((x) => `e_${x.id}` === id);
  return pack ? { id: `e_${pack.id}`, name: name(pack.names), accent: "#fbbf24" } : undefined;
}

const COLUMNS = { back: "equipped_back", frame: "equipped_frame", name: "equipped_name", fx: "equipped_fx" } as const;
export type Slot = keyof typeof COLUMNS;

/** What a player wears; nothing (rather than an error) for a database that has not got the newer columns. */
export async function loadWorn(supabase: SupabaseClient, userId: string): Promise<Worn> {
  const all = await supabase.from("profiles").select("equipped_back, equipped_frame, equipped_name, equipped_fx").eq("id", userId).maybeSingle();
  if (!all.error && all.data) {
    const d = all.data as Record<string, string | null>;
    return { back: d.equipped_back, frame: d.equipped_frame, name: d.equipped_name, fx: d.equipped_fx };
  }
  const only = await supabase.from("profiles").select("equipped_back").eq("id", userId).maybeSingle();
  return { ...NOTHING_WORN, back: (only.data?.equipped_back as string | null | undefined) ?? null };
}

/** Puts an owned item on (null takes it off). */
export async function wear(supabase: SupabaseClient, userId: string, slot: Slot, itemId: string | null): Promise<string | null> {
  const { error } = await supabase.from("profiles").update({ [COLUMNS[slot]]: itemId }).eq("id", userId);
  return error ? error.message : null;
}

/** The slot an item kind is worn in; null for kinds that are not worn (themes, emote packs). */
export function slotOf(kind: string): Slot | null {
  return kind === "card_back" ? "back" : kind === "frame" ? "frame" : kind === "name_style" ? "name" : kind === "win_fx" ? "fx" : null;
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
