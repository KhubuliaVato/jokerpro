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
  { id: "carbon", get name() { return "Carbon"; }, accent: "#94a3b8" },
  { id: "damask", get name() { return "Elegant"; }, accent: "#f43f5e" },
  { id: "frost", get name() { return "Ice"; }, accent: "#7dd3fc" },
];

export const cardBack = (id: string | null | undefined) => CARD_BACKS.find((b) => b.id === id);

export interface StockItem {
  id: string;
  kind: "card_back" | "theme" | "frame" | "name_style" | "win_fx" | "emote_pack";
  price: number;
  tier: "permanent" | "rotating";
  /** When a rotating item leaves the shop; null for a permanent one. */
  ends_at: string | null;
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
