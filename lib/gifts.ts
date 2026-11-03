import type { SupabaseClient } from "@supabase/supabase-js";
import { cosmetic } from "./cosmetics";
import { tt } from "./lang";
import { cardBack } from "./shop";
import { themeById } from "./themes";

export const LETTER_MAX = 300;

/** A gift the player has not been shown yet. */
export interface Gift {
  id: string;
  from_nick: string;
  item_id: string;
  message: string;
  created_at: string;
}

/** The name of any item of the shop, whatever its kind. */
export function itemName(id: string): string {
  const theme = themeById(id)?.name;
  if (theme) return tt(theme[0], theme[1], theme[2]);
  return cardBack(id)?.name ?? cosmetic(id)?.name ?? id;
}

/** Tells the inventory (and anything else listing what the player owns) that it has changed. */
export const INVENTORY_CHANGED = "inventory:changed";

const ERRORS: Record<string, () => string> = {
  "no such player": () => tt("ასეთი მოთამაშე არ მოიძებნა", "No player with this nickname", "Игрок с таким никнеймом не найден"),
  "cannot gift yourself": () => tt("საკუთარ თავს ვერ აჩუქებთ", "You cannot gift yourself", "Нельзя подарить самому себе"),
  "receiver already owns it": () => tt("მას ეს ნივთი უკვე აქვს", "They already own this item", "Этот предмет у них уже есть"),
  "item not owned": () => tt("ეს ნივთი თქვენ აღარ გაქვთ", "You no longer own this item", "У вас больше нет этого предмета"),
  "too many gifts": () => tt("დღეში 20 საჩუქარი შეიძლება", "At most 20 gifts a day", "Не больше 20 подарков в день"),
  "not signed in": () => tt("ჯერ შედით ანგარიშში", "Sign in first", "Сначала войдите"),
};

/** Sends an item with a letter; returns an error message, or null when it went. */
export async function sendGift(supabase: SupabaseClient, to: string, itemId: string, message: string): Promise<string | null> {
  const { error } = await supabase.rpc("send_gift", { p_to: to.trim(), p_item: itemId, p_message: message });
  if (!error) return null;
  const known = Object.keys(ERRORS).find((k) => error.message.includes(k));
  return known ? ERRORS[known]() : error.message;
}

export async function unseenGifts(supabase: SupabaseClient): Promise<Gift[]> {
  const { data } = await supabase.rpc("unseen_gifts");
  return (data ?? []) as Gift[];
}

export async function markGiftsSeen(supabase: SupabaseClient): Promise<void> {
  await supabase.rpc("mark_gifts_seen");
}
