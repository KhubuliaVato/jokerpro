import { tt } from "../lang";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameState } from "@/lib/joker/engine";
import type { BuraState } from "@/lib/bura/engine";
import type { PokerState } from "@/lib/poker/engine";
import type { PokerRules } from "@/lib/poker/online";
import type { Rules } from "@/lib/joker/rules";
import type { BuraRules } from "@/lib/bura/online";

export interface TableRow {
  id: string;
  code: string;
  host_id: string;
  /** private: friends with a code. friendly / ranked: random players (ranked changes the rating). */
  kind: "private" | "friendly" | "ranked";
  status: "waiting" | "playing" | "finished" | "closed";
  game: "joker" | "bura" | "poker";
  rules: Rules | BuraRules | PokerRules;
  /** When the table of random players filled up: everyone then has READY_SECONDS to accept. */
  ready_at: string | null;
  /** At a finished private table: the code of the table where the same friends play again (set once someone asks). */
  rematch_code?: string | null;
}

export interface SeatRow {
  seat: number;
  user_id: string;
  bot: boolean;
  accepted: boolean;
  /** When the player left (or was kicked): a bot has the seat since, and the player can take it back for 7 minutes. */
  left_at?: string | null;
  returned?: boolean;
}

export const READY_SECONDS = 30;

/** Fired on the window after leaving a game, so the red ban strip looks at the database again. */
export const BAN_CHANGED = "ban:changed";

/** The ban a player got for leaving a game: no new tables until `until`; the old seat can be won back until `returnUntil`. */
export interface PlayBan {
  until: string;
  returnUntil: string | null;
  tableId: string | null;
}

/** The player's own, already rotated view of the game, as the server wrote it. */
export interface ViewRow {
  version: number;
  seat: number;
  view: GameState | BuraState | PokerState;
  turn_deadline: string | null;
}

/** Georgian text for what the database and the game server can answer. */
export function onlineMessage(message: string): string {
  const m = message.toLowerCase();
  const ban = /play ban until (\S+)/i.exec(message);
  if (ban) {
    const until = new Date(ban[1]);
    const at = Number.isNaN(until.getTime()) ? "" : until.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return tt(
      `თამაშიდან გასვლის გამო ახალ მაგიდაზე ${at}-მდე ვერ დაჯდებით`,
      `You left a game, so you cannot join a new table until ${at}`,
      `Вы покинули игру, поэтому не можете сесть за новый стол до ${at}`,
    );
  }
  if (m.includes("too late to return")) return tt("დაბრუნების დრო გავიდა", "The time to return is over", "Время возвращения вышло");
  if (m.includes("no rematch")) return tt("ხელახლა თამაში ამ მაგიდაზე ვერ მოხერხდა", "A rematch is not possible at this table", "Реванш за этим столом невозможен");
  if (m.includes("the game is over")) return tt("თამაში უკვე დასრულდა", "The game is already over", "Игра уже закончилась");
  if (m.includes("table not found")) return tt("ასეთი კოდით მაგიდა ვერ მოიძებნა", "No table with this code", "Стола с таким кодом нет");
  if (m.includes("already started")) return tt("ამ მაგიდაზე თამაში უკვე დაიწყო", "The game at this table has already started", "Игра за этим столом уже началась");
  if (m.includes("table is full")) return tt("მაგიდა სავსეა", "The table is full", "Стол заполнен");
  if (m.includes("not signed in")) return tt("ჯერ შედით ანგარიშში", "Sign in first", "Сначала войдите");
  if (m.includes("not your turn")) return tt("ახლა თქვენი სვლა არ არის", "It is not your turn", "Сейчас не ваш ход");
  if (m.includes("illegal")) return tt("ეს სვლა დაუშვებელია", "This move is not allowed", "Этот ход недопустим");
  if (m.includes("not seated")) return tt("თქვენ ამ მაგიდასთან არ ზიხართ", "You are not seated at this table", "Вы не сидите за этим столом");
  if (m.includes("already in a game")) return tt("თქვენ უკვე გაქვთ დაწყებული თამაში: ჯერ დაბრუნდით მასში ან გამოდით", "You already have a game in progress: return to it or leave it first", "У вас уже есть начатая игра: сначала вернитесь в неё или выйдите");
  if (m.includes("failed to fetch") || m.includes("network")) return tt("კავშირის შეცდომა, შეამოწმეთ ინტერნეტი", "Connection error, check your internet", "Ошибка соединения, проверьте интернет");
  return `${tt("შეცდომა", "Error", "Ошибка")}: ${message}`;
}

/** Normalises what a player typed as a join code: letters and digits only, upper case. */
export const cleanCode = (raw: string) => raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);

export async function createTable(
  supabase: SupabaseClient,
  rules: Rules | { game: "bura"; players: 2 | 4 } | { game: "poker"; players: number; bigBlind: 10 | 20 | 50 },
): Promise<{ table: TableRow | null; error: string | null }> {
  const { data, error } = await supabase.rpc("create_table", { p_rules: rules });
  return { table: (data as TableRow | null) ?? null, error: error ? onlineMessage(error.message) : null };
}

export async function joinTable(
  supabase: SupabaseClient,
  code: string,
): Promise<{ table: TableRow | null; error: string | null }> {
  const { data, error } = await supabase.rpc("join_table", { p_code: code });
  return { table: (data as TableRow | null) ?? null, error: error ? onlineMessage(error.message) : null };
}

/** Sits the player at an open table of random players, or opens a new one. */
export async function findTable(
  supabase: SupabaseClient,
  kind: "ranked" | "friendly",
  format: "nine" | "full" | "p2" | "p4",
  game: "joker" | "bura" = "joker",
): Promise<{ table: TableRow | null; error: string | null }> {
  const { data, error } = await supabase.rpc("find_table", { p_kind: kind, p_format: format, p_game: game });
  return { table: (data as TableRow | null) ?? null, error: error ? onlineMessage(error.message) : null };
}

/** "I am still waiting here": seats of silent players are given up after about 40 seconds. */
export async function pingTable(supabase: SupabaseClient, tableId: string): Promise<void> {
  await supabase.rpc("table_ping", { p_table_id: tableId });
}

/** Where a table lives in the site: /joker/table/ABC123 or /bura/table/ABC123. */
/** At a finished private table: opens a new table with the same rules, or seats the player at the one a friend already opened. */
export async function rematchTable(supabase: SupabaseClient, tableId: string): Promise<{ table: TableRow | null; error: string | null }> {
  const { data, error } = await supabase.rpc("rematch", { p_table_id: tableId });
  return { table: (data as TableRow | null) ?? null, error: error ? onlineMessage(error.message) : null };
}

export const tablePath = (t: Pick<TableRow, "game" | "code">) => `/${t.game}/table/${t.code}`;

/** The running game the player is part of (e.g. after closing the page), if any. */
export async function activeTable(supabase: SupabaseClient): Promise<TableRow | null> {
  const { data } = await supabase.rpc("my_active_table");
  const row = (Array.isArray(data) ? data[0] : data) as TableRow | null;
  return row && row.id ? row : null;
}

/** The ban the signed-in player has right now, or null. Players can read only their own. */
export async function myPlayBan(supabase: SupabaseClient, userId: string): Promise<PlayBan | null> {
  const { data } = await supabase
    .from("play_bans")
    .select("until, return_until, table_id")
    .eq("user_id", userId)
    .gt("until", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  return { until: data.until as string, returnUntil: (data.return_until as string | null) ?? null, tableId: (data.table_id as string | null) ?? null };
}

/** The running game this player left less than 7 minutes ago and can still return to. */
export async function returnableTable(supabase: SupabaseClient): Promise<TableRow | null> {
  const { data } = await supabase.rpc("my_returnable_table");
  const row = (Array.isArray(data) ? data[0] : data) as TableRow | null;
  return row && row.id ? row : null;
}

/** Takes the seat back from the bot. Resolves to an error message, or null on success. */
export const returnToTable = (supabase: SupabaseClient, tableId: string, game: TableRow["game"]) =>
  callJoker(supabase, { action: "return", table_id: tableId }, game === "poker" ? "poker" : "joker");

/** Lobbies of random players waiting for someone, per game; empty when the database cannot tell. */
export async function openTableCounts(supabase: SupabaseClient): Promise<Partial<Record<TableRow["game"], number>>> {
  const { data, error } = await supabase.rpc("open_tables");
  const out: Partial<Record<TableRow["game"], number>> = {};
  if (error || !Array.isArray(data)) return out;
  for (const r of data as { game: TableRow["game"]; waiting: number }[]) out[r.game] = r.waiting;
  return out;
}

/** How far the server's clock is ahead of this device's (ms), so that deadlines are counted on the server's time. */
export async function clockSkew(supabase: SupabaseClient): Promise<number> {
  const before = Date.now();
  const { data } = await supabase.rpc("server_time");
  const after = Date.now();
  return typeof data === "string" ? Date.parse(data) - (before + after) / 2 : 0;
}

/** "Yes, I am ready" in the ready check. */
export async function acceptMatch(supabase: SupabaseClient, tableId: string): Promise<void> {
  await supabase.rpc("accept_match", { p_table_id: tableId });
}

/** The 30 seconds are over: seats of those who did not accept are given up. */
export async function expireMatch(supabase: SupabaseClient, tableId: string): Promise<void> {
  await supabase.rpc("expire_match", { p_table_id: tableId });
}

export async function leaveTable(supabase: SupabaseClient, tableId: string): Promise<void> {
  await supabase.rpc("leave_table", { p_table_id: tableId });
}

/**
 * The Edge Function must run in the region of the database. Left alone it may run far from the database (it
 * used to sit in Seoul, now it is in Frankfurt), and each of its half-dozen queries then crosses the planet.
 * Sent as a query parameter only (the `region` option would also add an `x-region` header the function's CORS
 * answer does not allow). If the project's database ever moves, change this to the new region.
 */
const GAME_SERVER_REGION = "eu-central-1";

let warmed = false;

/**
 * Wakes the Edge Functions and opens the connection to them before the first move (a cold start costs a second or two).
 * The CORS pre-flight answers before any work is done, so this is free for the server.
 */
export function warmGameServers(): void {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (warmed || !base) return;
  warmed = true;
  for (const server of ["joker", "poker"]) {
    fetch(`${base}/functions/v1/${server}?forceFunctionRegion=${GAME_SERVER_REGION}`, { method: "OPTIONS" }).catch(() => {});
  }
}

/** Calls the game server: Edge Function `joker` (Joker and Bura) or `poker` (Hold'em). Resolves to an error message, or null on success. */
export async function callJoker(supabase: SupabaseClient, body: Record<string, unknown>, server: "joker" | "poker" = "joker"): Promise<string | null> {
  const { error } = await supabase.functions.invoke(`${server}?forceFunctionRegion=${GAME_SERVER_REGION}`, { body });
  if (!error) return null;
  // The server explains refusals in the response body.
  const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
  return onlineMessage(detail?.error ?? error.message);
}
