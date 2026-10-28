import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameState } from "@/lib/joker/engine";
import type { BuraState } from "@/lib/bura/engine";
import type { Rules } from "@/lib/joker/rules";
import type { BuraRules } from "@/lib/bura/online";

export interface TableRow {
  id: string;
  code: string;
  host_id: string;
  /** private: friends with a code. friendly / ranked: random players (ranked changes the rating). */
  kind: "private" | "friendly" | "ranked";
  status: "waiting" | "playing" | "finished" | "closed";
  game: "joker" | "bura";
  rules: Rules | BuraRules;
  /** When the table of random players filled up: everyone then has READY_SECONDS to accept. */
  ready_at: string | null;
}

export interface SeatRow {
  seat: number;
  user_id: string;
  bot: boolean;
  accepted: boolean;
}

export const READY_SECONDS = 30;

/** The player's own, already rotated view of the game, as the server wrote it. */
export interface ViewRow {
  version: number;
  seat: number;
  view: GameState | BuraState;
  turn_deadline: string | null;
}

/** Georgian text for what the database and the game server can answer. */
export function onlineMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("table not found")) return "ასეთი კოდით მაგიდა ვერ მოიძებნა";
  if (m.includes("already started")) return "ამ მაგიდაზე თამაში უკვე დაიწყო";
  if (m.includes("table is full")) return "მაგიდა სავსეა";
  if (m.includes("not signed in")) return "ჯერ შედით ანგარიშში";
  if (m.includes("not your turn")) return "ახლა თქვენი სვლა არ არის";
  if (m.includes("illegal")) return "ეს სვლა დაუშვებელია";
  if (m.includes("not seated")) return "თქვენ ამ მაგიდასთან არ ზიხართ";
  if (m.includes("already in a game")) return "თქვენ უკვე გაქვთ დაწყებული თამაში: ჯერ დაბრუნდით მასში ან გამოდით";
  if (m.includes("failed to fetch") || m.includes("network")) return "კავშირის შეცდომა, შეამოწმეთ ინტერნეტი";
  return `შეცდომა: ${message}`;
}

/** Normalises what a player typed as a join code: letters and digits only, upper case. */
export const cleanCode = (raw: string) => raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);

export async function createTable(
  supabase: SupabaseClient,
  rules: Rules | { game: "bura"; players: 2 | 4 },
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
export const tablePath = (t: Pick<TableRow, "game" | "code">) => `/${t.game}/table/${t.code}`;

/** The running game the player is part of (e.g. after closing the page), if any. */
export async function activeTable(supabase: SupabaseClient): Promise<TableRow | null> {
  const { data } = await supabase.rpc("my_active_table");
  const row = (Array.isArray(data) ? data[0] : data) as TableRow | null;
  return row && row.id ? row : null;
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
 * The Edge Function must run in the region of the database. Left alone it runs near the player (Europe) while the
 * database is in Seoul, and each of its half-dozen queries then crosses the planet: ~2 s per move instead of ~0.5 s.
 * Sent as a query parameter only (the `region` option would also add an `x-region` header the function's CORS
 * answer does not allow). If the project's database ever moves, change this to the new region.
 */
const GAME_SERVER_REGION = "ap-northeast-2";

/** Calls the game server (Edge Function `joker`). Resolves to an error message, or null on success. */
export async function callJoker(supabase: SupabaseClient, body: Record<string, unknown>): Promise<string | null> {
  const { error } = await supabase.functions.invoke(`joker?forceFunctionRegion=${GAME_SERVER_REGION}`, { body });
  if (!error) return null;
  // The server explains refusals in the response body.
  const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
  return onlineMessage(detail?.error ?? error.message);
}
