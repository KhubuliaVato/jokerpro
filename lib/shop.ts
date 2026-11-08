import type { SupabaseClient } from "@supabase/supabase-js";
import { tt } from "./lang";

/** How a card back is drawn: the CSS lives in globals.css under `[data-skin="<id>"]`; this is its look for previews. */
export interface CardBack {
  id: string;
  name: string;
  /** The colour of the glow and the accents around it. */
  accent: string;
}

/** The pictures and names of the shop's items; the prices and the weekly stock come from the database. */
export const CARD_BACKS: CardBack[] = [
  { id: "crimson", get name() { return "OldBlood"; }, accent: "#e11d48" },
  { id: "emerald", get name() { return "Emerald"; }, accent: "#10b981" },
  { id: "midnight", get name() { return "Goodnight"; }, accent: "#6366f1" },
  { id: "gilded", get name() { return tt("ოქროს ქსოვა", "Gilded", "Золочёная"); }, accent: "#fbbf24" },
  { id: "neon", get name() { return tt("ნეონი", "Neon", "Неон"); }, accent: "#22d3ee" },
  { id: "obsidian", get name() { return tt("ობსიდიანი", "Obsidian", "Обсидиан"); }, accent: "#a78bfa" },
  { id: "sakura", get name() { return tt("საკურა", "Sakura", "Сакура"); }, accent: "#f9a8d4" },
  { id: "aurora", get name() { return tt("ავრორა", "Aurora", "Аврора"); }, accent: "#34d399" },
  { id: "matrix", get name() { return "Matrix"; }, accent: "#22c55e" },
  { id: "carbon", get name() { return "Carbon"; }, accent: "#94a3b8" },
  { id: "damask", get name() { return "Elegant"; }, accent: "#f43f5e" },
  { id: "frost", get name() { return "Ice"; }, accent: "#7dd3fc" },
];

export const cardBack = (id: string | null | undefined) => CARD_BACKS.find((b) => b.id === id);

export interface StockItem {
  id: string;
  kind: "card_back" | "theme" | "frame" | "name_style" | "win_fx" | "reaction" | "throwable" | "play_fx" | "sound_pack" | "joker_skin";
  price: number;
  tier: "permanent" | "rotating";
  /** When a rotating item leaves the shop; null for a permanent one. */
  ends_at: string | null;
  rarity: "standard" | "epic" | "legendary" | "ultimate" | "mythic";
}

/** What is on sale now: the permanent items and this week's rotating ones. */
export async function loadStock(supabase: SupabaseClient): Promise<StockItem[]> {
  const { data } = await supabase.rpc("shop_stock");
  return (data ?? []) as StockItem[];
}

/** The ids of what a player owns. */
export async function loadInventory(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_items").select("item_id").eq("user_id", userId).order("acquired_at", { ascending: false });
  return (data ?? []).map((r) => r.item_id as string);
}

/** The card back a player wears; null for the standard one (or before the shop exists in the database). */
export async function loadEquipped(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("equipped_back").eq("id", userId).maybeSingle();
  return (data?.equipped_back as string | null | undefined) ?? null;
}

/** Tells the header (and anything else showing the coins) that the balance has changed. */
export const COINS_CHANGED = "coins:changed";

const BUY_ERRORS: Record<string, () => string> = {
  "not enough coins": () => tt("მონეტები არ გყოფნით", "Not enough coins", "Не хватает монет"),
  "already owned": () => tt("ეს უკვე გაქვთ", "You already own this", "Это уже у вас есть"),
  "not in stock": () => tt("ეს ნივთი ახლა მაღაზიაში არ არის", "This item is not on sale now", "Этого предмета сейчас нет в магазине"),
  "not signed in": () => tt("ჯერ შედით ანგარიშში", "Sign in first", "Сначала войдите"),
};

/** Buys an item; returns the new balance, or an error message. */
export async function buyItem(supabase: SupabaseClient, itemId: string): Promise<{ balance: number | null; error: string | null }> {
  const { data, error } = await supabase.rpc("buy_item", { p_item: itemId });
  if (error) {
    const known = Object.keys(BUY_ERRORS).find((k) => error.message.includes(k));
    return { balance: null, error: known ? BUY_ERRORS[known]() : error.message };
  }
  return { balance: data as number, error: null };
}

/** Puts an owned card back on the table (null: the standard one). */
export async function equipBack(supabase: SupabaseClient, userId: string, itemId: string | null): Promise<string | null> {
  const { error } = await supabase.from("profiles").update({ equipped_back: itemId }).eq("id", userId);
  return error ? error.message : null;
}

/** "3 days" until a rotating item leaves the shop; a started day counts as a day, so it is never "0 days". */
export function daysLeft(endsAt: string, now = Date.now()): string {
  const days = Math.max(1, Math.ceil((new Date(endsAt).getTime() - now) / 86_400_000));
  return days === 1 ? tt("1 დღე", "1 day", "1 день") : tt(`${days} დღე`, `${days} days`, `${days} дн.`);
}

/** A pack: several items sold together for less than the sum of their prices. */
export interface Bundle {
  id: string;
  price: number;
  items: string[];
}

/** The look and the words of a pack; what is in it and its price come from the database. */
export const BUNDLE_INFO: Record<string, { name: () => string; blurb: () => string; accent: string; /** The background item whose moving layer fills the card, and its two colours. */ theme: string; bg: [string, string] }> = {
  b_sakura: {
    name: () => tt("საკურას პაკი", "Sakura pack", "Набор «Сакура»"),
    blurb: () =>
      tt(
        "ყვავილოვანი ბაღი: კარტი, ფონი, ჩარჩო, სახელი, ეფექტები, ხმა და რეაქცია, ყველაფერი ერთ სტილში.",
        "A blossom garden: cards, background, frame, name, effects, sound and a reaction, all in one style.",
        "Сад сакуры: карты, фон, рамка, имя, эффекты, звук и реакция в одном стиле.",
      ),
    accent: "#f9a8d4",
    theme: "blossom",
    bg: ["#b4537c", "#26101f"],
  },
  b_carbon: {
    name: () => tt("კარბონის პაკი", "Carbon pack", "Набор «Карбон»"),
    blurb: () =>
      tt(
        "სიჩქარე და მეტალი: კარტი, ფონი, ჩარჩო, სახელი, ეფექტები, ხმა და რეაქცია, ყველაფერი ერთ სტილში.",
        "Speed and metal: cards, background, frame, name, effects, sound and a reaction, all in one style.",
        "Скорость и металл: карты, фон, рамка, имя, эффекты, звук и реакция в одном стиле.",
      ),
    accent: "#f87171",
    theme: "carbonbg",
    bg: ["#3a3f48", "#07080a"],
  },
  b_ice: {
    name: () => tt("ყინულის პაკი", "Ice pack", "Набор «Лёд»"),
    blurb: () =>
      tt(
        "მყინვარის სიცივე: კარტი, ფონი, ჩარჩო, სახელი, ეფექტები, ხმა და რეაქცია, ყველაფერი ერთ სტილში.",
        "Glacier cold: cards, background, frame, name, effects, sound and a reaction, all in one style.",
        "Холод ледника: карты, фон, рамка, имя, эффекты, звук и реакция в одном стиле.",
      ),
    accent: "#7dd3fc",
    theme: "glacier",
    bg: ["#2f7f9c", "#06141f"],
  },
  b_night: {
    name: () => tt("Goodnight პაკი", "Goodnight pack", "Набор «Goodnight»"),
    blurb: () =>
      tt(
        "მთვარიანი ღამე: კარტი, ფონი, ჩარჩო, სახელი, ეფექტები, ხმა და რეაქცია, ყველაფერი ერთ სტილში.",
        "A moonlit night: cards, background, frame, name, effects, sound and a reaction, all in one style.",
        "Лунная ночь: карты, фон, рамка, имя, эффекты, звук и реакция в одном стиле.",
      ),
    accent: "#818cf8",
    theme: "lullaby",
    bg: ["#3b3787", "#05061c"],
  },
  b_matrix: {
    name: () => tt("Matrix პაკი", "Matrix pack", "Набор «Matrix»"),
    blurb: () =>
      tt(
        "მწვანე კოდის წვიმა: ანიმირებული კარტი, ფონი, ჩარჩო, სახელი, ეფექტები, ხმა და რეაქცია.",
        "Falling green code: an animated deck, background, frame, name, effects, sound and a reaction.",
        "Зелёный дождь из кода: анимированные карты, фон, рамка, имя, эффекты, звук и реакция.",
      ),
    accent: "#4ade80",
    theme: "matrixbg",
    bg: ["#064e1f", "#000a03"],
  },
};

export async function loadBundles(supabase: SupabaseClient): Promise<Bundle[]> {
  const { data } = await supabase.from("shop_bundles").select("id, price, sort, shop_bundle_items(item_id)").order("sort");
  return (data ?? []).map((b) => ({
    id: b.id as string,
    price: b.price as number,
    items: ((b.shop_bundle_items ?? []) as { item_id: string }[]).map((x) => x.item_id),
  }));
}

/** Buys what a player does not own yet of a pack; returns the new balance, or an error message. */
export async function buyBundle(supabase: SupabaseClient, bundleId: string): Promise<{ balance: number | null; error: string | null }> {
  const { data, error } = await supabase.rpc("buy_bundle", { p_bundle: bundleId });
  if (error) {
    const known = Object.keys(BUY_ERRORS).find((k) => error.message.includes(k));
    return { balance: null, error: known ? BUY_ERRORS[known]() : error.message };
  }
  return { balance: data as number, error: null };
}
