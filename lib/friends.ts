import type { SupabaseClient } from "@supabase/supabase-js";
import { tt } from "./lang";

export interface Friend {
  id: string;
  nickname: string;
  avatar_color: string;
  avatar_icon: string;
  avatar_url: string | null;
  equipped_frame: string | null;
  equipped_name: string | null;
  city: string | null;
  online: boolean;
  playing: boolean;
  /** The game they are playing right now (joker, bura, poker). */
  game: string | null;
  last_seen: string | null;
}

export interface FriendRequest {
  id: string;
  nickname: string;
  avatar_color: string;
  avatar_icon: string;
  avatar_url: string | null;
  equipped_frame: string | null;
  equipped_name: string | null;
}

export interface FriendList {
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: { id: string; nickname: string }[];
  /** The player hides their online status from their friends. */
  hidden: boolean;
}

export const EMPTY_FRIENDS: FriendList = { friends: [], incoming: [], outgoing: [], hidden: false };

export async function loadFriends(supabase: SupabaseClient): Promise<FriendList> {
  const { data } = await supabase.rpc("my_friends");
  const d = data as Partial<FriendList> | null;
  return { friends: d?.friends ?? [], incoming: d?.incoming ?? [], outgoing: d?.outgoing ?? [], hidden: d?.hidden ?? false };
}

/** The server hears that this player is here (it counts them as online for about two minutes). */
export async function touchPresence(supabase: SupabaseClient): Promise<void> {
  await supabase.rpc("touch_presence");
}

export async function setHidePresence(supabase: SupabaseClient, hide: boolean): Promise<void> {
  await supabase.rpc("set_hide_presence", { p_hide: hide });
}

function message(raw: string): string {
  if (raw.includes("no such player")) return tt("ასეთი მოთამაშე ვერ მოიძებნა", "No such player", "Такого игрока нет");
  if (raw.includes("that is you")) return tt("ეს თქვენ ხართ :)", "That is you :)", "Это вы :)");
  if (raw.includes("too many friends")) return tt("მეგობრების ლიმიტი (200) ამოიწურა", "Friend limit (200) reached", "Лимит друзей (200)");
  if (raw.includes("too many requests")) return tt("ძალიან ბევრი გაგზავნილი თხოვნა", "Too many pending requests", "Слишком много заявок");
  return raw;
}

/** Asks a player (by nickname) to be friends. Returns what to tell the player, and whether it worked. */
export async function sendFriendRequest(supabase: SupabaseClient, nickname: string): Promise<{ ok: boolean; text: string }> {
  const { data, error } = await supabase.rpc("friend_request", { p_nickname: nickname });
  if (error) return { ok: false, text: message(error.message) };
  if (data === "accepted") return { ok: true, text: tt("ახლა მეგობრები ხართ!", "You are friends now!", "Теперь вы друзья!") };
  if (data === "already") return { ok: true, text: tt("თხოვნა უკვე გაგზავნილია ან უკვე მეგობრები ხართ", "Already sent, or you are already friends", "Уже отправлено или вы уже друзья") };
  return { ok: true, text: tt("თხოვნა გაიგზავნა", "Request sent", "Заявка отправлена") };
}

export async function answerFriendRequest(supabase: SupabaseClient, user: string, accept: boolean): Promise<void> {
  await supabase.rpc("friend_respond", { p_user: user, p_accept: accept });
}

export async function removeFriend(supabase: SupabaseClient, user: string): Promise<void> {
  await supabase.rpc("friend_remove", { p_user: user });
}

/** "2 წთ წინ" for the last time a friend was seen. */
export function seenAgo(iso: string | null): string {
  if (!iso) return tt("დიდი ხნის წინ", "a long time ago", "давно");
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 3600) return tt(`${Math.max(1, Math.round(s / 60))} წთ წინ`, `${Math.max(1, Math.round(s / 60))} min ago`, `${Math.max(1, Math.round(s / 60))} мин назад`);
  if (s < 86400) return tt(`${Math.round(s / 3600)} სთ წინ`, `${Math.round(s / 3600)} h ago`, `${Math.round(s / 3600)} ч назад`);
  return tt(`${Math.round(s / 86400)} დღის წინ`, `${Math.round(s / 86400)} d ago`, `${Math.round(s / 86400)} дн назад`);
}
